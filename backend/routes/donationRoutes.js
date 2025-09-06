// backend/routes/donationRoutes.js
const express = require("express");
const router = express.Router();
const Donation = require("../models/donationModel");
const authMiddleware = require("../middleware/authMiddleware");

// CREATE a new donation
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { foodItems, serves, pickupBy, location } = req.body;
    const newDonation = new Donation({
      donorId: req.user.id,
      foodItems,
      serves,
      pickupBy,
      location,
    });
    const donation = await newDonation.save();
    res.status(201).json(donation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET all donations for the logged-in donor
router.get("/mydonations", authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ donorId: req.user.id })
      .populate("volunteerId", "fullName") // Corrected to volunteerId
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET all donations assigned to the logged-in volunteer
router.get("/mypickups", authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ volunteerId: req.user.id })
      .populate("donorId", "fullName phoneNumber") // Corrected field name
      .sort({ updatedAt: -1 });
    res.json(donations);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// GET nearby available donations
// MOVED UP: This specific route now comes before the dynamic /:id route
router.get("/nearby", authMiddleware, async (req, res) => {
  const { lat, lng, minServes } = req.query;
  if (!lat || !lng) {
    return res
      .status(400)
      .json({ message: "Latitude and longitude are required." });
  }
  try {
    const donations = await Donation.aggregate([
      // STAGE 1: Find all documents by location first.
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          distanceField: "dist.calculated",
          maxDistance: 50000, // 50km
          spherical: true,
        },
      },
      // STAGE 2: THEN, filter the results by status and serves.
      {
        $match: {
          status: { $in: ["Available", "Pickup Accepted"] },
          serves: { $gte: parseInt(minServes) || 0 },
        },
      },
      // STAGE 3: Lookup donor information for the filtered results.
      {
        $lookup: {
          from: "users",
          localField: "donorId",
          foreignField: "_id",
          as: "donorInfo",
        },
      },
      // STAGE 4: Unwind donorInfo (a donation must have a donor).
      { $unwind: "$donorInfo" },
      // STAGE 5: Remove sensitive fields.
      {
        $project: {
          "donorInfo.password": 0,
        },
      },
    ]);
    res.json(donations);
  } catch (err) {
    console.error("GeoNear Error:", err.message);
    res.status(500).send("Server Error");
  }
});

// GET a single donation by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: "Donation not found." });
    }
    res.json(donation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// UPDATE a donation
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { foodItems, serves, pickupBy, location } = req.body;
    let donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: "Donation not found." });
    }
    // Ensure the user updating is the donor
    if (donation.donorId.toString() !== req.user.id) {
      return res.status(401).json({ message: "User not authorized." });
    }
    // Don't allow edits if it's already accepted
    if (donation.status !== "Available") {
      return res
        .status(400)
        .json({ message: "Cannot edit a donation that has been accepted." });
    }

    donation.foodItems = foodItems;
    donation.serves = serves;
    donation.pickupBy = pickupBy;
    donation.location = location;

    await donation.save();
    res.json(donation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// VOLUNTEER ACTION: Accept a donation pickup
router.patch("/accept/:id", authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation) {
      return res.status(404).json({ message: "Donation not found." });
    }
    if (donation.status !== "Available") {
      return res
        .status(400)
        .json({ message: "Donation is no longer available." });
    }

    donation.status = "Pickup Accepted";
    donation.volunteerId = req.user.id;
    await donation.save();

    res.json({ message: "Pickup accepted successfully!", donation });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// VOLUNTEER ACTION: Reject/Cancel an accepted pickup
router.patch("/reject/:id", authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation)
      return res.status(404).json({ message: "Donation not found." });

    if (donation.volunteerId.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to cancel this pickup." });
    }

    donation.status = "Available";
    donation.volunteerId = undefined;
    await donation.save();
    res.json({ message: "Pickup cancelled." });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// VOLUNTEER ACTION: Mark a pickup as complete
router.patch("/complete/:id", authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id);
    if (!donation)
      return res.status(404).json({ message: "Donation not found." });

    if (donation.volunteerId.toString() !== req.user.id) {
      return res
        .status(401)
        .json({ message: "Not authorized to complete this pickup." });
    }

    donation.status = "Completed";
    await donation.save();
    res.json({ message: "Pickup completed successfully!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;

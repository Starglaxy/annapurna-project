// backend/models/donationModel.js
const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Array to handle multiple food items
    foodItems: [{
        name: { type: String, required: true },
        quantity: { type: String, required: true } // e.g., "5 kg", "20 packets"
    }],
    serves: { type: Number, required: true },
    pickupBy: { type: Date, required: true },
    status: {
        type: String,
        enum: ['Available', 'Pickup Accepted', 'Completed', 'Expired', 'Cancelled'],
        default: 'Available'
    },
    // GeoJSON for the donation's location
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    volunteerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

// Index for geospatial queries
donationSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Donation', donationSchema);
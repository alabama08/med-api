import mongoose from "mongoose";

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },   // e.g. "500mg"
  frequency: { type: String, required: true }, // e.g. "Twice daily"
  duration: { type: String, required: true },  // e.g. "7 days"
  instructions: { type: String, default: "" },
});

const prescriptionSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
    medications: [medicationSchema],
    diagnosis: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      default: "",
    },
    followUpDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const Prescription = mongoose.model("Prescription", prescriptionSchema);
export default Prescription;
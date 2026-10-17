const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
	phoneNumber: {
		type: String,
		required: true,
		unique: true,
	},
	password: {
		type: String,
		required: true,
	},
	role: {
		type: String,
		enum: ['client', 'executive'],
		required: true,
	},
	name: {
		type: String,
		required: true,
	},
	email: {
		type: String,
	},
	address: {
		type: String,
	},
	clientId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	executiveId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
	},
	executives: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
	permissions: {
		addNewEnquiry: { type: Boolean, default: false },
		executiveManagement: { type: Boolean, default: false },
		enquiryList: { type: Boolean, default: true },
		viewOrders: { type: Boolean, default: false },
	},
	isActive: {
		type: Boolean,
		default: true,
	},
}, { timestamps: true });

// UserSchema.pre('save', async function (next) {
// 	if (!this.isModified('password')) return next();

// 	const salt = await bcrypt.genSalt(10);
// 	this.password = await bcrypt.hash(this.password, salt);
// 	next();
// });

// UserSchema.methods.matchPassword = async function (enteredPassword) {
// 	return await bcrypt.compare(enteredPassword, this.password);
// };

const User = mongoose.model('User', UserSchema);

module.exports = User;

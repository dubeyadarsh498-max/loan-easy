
// --- DEPENDENCIES & CONFIG (from package.json) ---
// Ensure these dependencies are installed: express, mongoose, jsonwebtoken, bcryptjs, multer, dotenv (and nodemon for dev)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use('/uploads', express.static('uploads'));
const PORT = process.env.PORT || 5000;


// --- DATABASE CONNECTION (from config/db.js) ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/loan_platform');
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
connectDB();


// --- MODELS (from models/User.js and models/LoanRequest.js) ---
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ['admin','lender','borrower'] },
  kyc: {
    pan: String,
    aadhaar: String,
    idProof: String, // filename or URL
    verified: { type: Boolean, default: false }
  },
  lenderProfile: {
    maxAmount: Number,
    interestRate: Number
  }
}, { timestamps: true });
const User = mongoose.model('User', UserSchema);

const LoanRequestSchema = new mongoose.Schema({
  borrower: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  interestRate: Number, // borrower desired rate
  periodMonths: Number,
  status: { type: String, enum: ['open','matched','accepted','rejected','admin_review'], default: 'open' },
  matchedWith: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // lender
  borrowerAccepted: { type: Boolean, default: false },
  lenderAccepted: { type: Boolean, default: false }
}, { timestamps: true });
const LoanRequest = mongoose.model('LoanRequest', LoanRequestSchema);


// --- MIDDLEWARE (from middleware/auth.js) ---
const auth = async function(req,res,next){
  const token = req.header('Authorization')?.replace('Bearer ','');
  if(!token) return res.status(401).json({msg:'No token'});
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.user = await User.findById(payload.id);
    next();
  }catch(e){
    res.status(401).json({msg:'Invalid token'})
  }
}


// --- UTILS (from utils/matcher.js) ---
const matcher = {};
// FIX: Using defined models
matcher.tryMatch = async function(loan){
  const lenders = await User.find({ role: 'lender', 'kyc.verified': true });
  // filter
  const candidate = lenders.find(l => (l.lenderProfile?.maxAmount || 0) >= loan.amount && (l.lenderProfile?.interestRate || 0) <= loan.interestRate);
  if(candidate){
    loan.matchedWith = candidate._id;
    loan.status = 'matched';
    await loan.save();
    return candidate;
  }
  return null;
}


// --- ROUTES: /api/auth (from routes/auth.js) ---
const authRouter = express.Router();
const upload = multer({ dest: 'uploads/' });

// Register (with optional role and lender profile)
authRouter.post('/register', upload.fields([{name:'pan'},{name:'aadhaar'},{name:'idProof'}]), async (req,res)=>{
  try{
    // FIX: Extract lender profile data
    const { name,email,password,role,maxAmount,interestRate } = req.body; 
    
    const hashed = await bcrypt.hash(password,10);
    const kyc = {
      pan: req.files?.pan?.[0]?.filename,
      aadhaar: req.files?.aadhaar?.[0]?.filename,
      idProof: req.files?.idProof?.[0]?.filename,
      verified: false
    };

    // FIX: Define lenderProfile if role is lender
    const lenderProfile = role === 'lender' ? { 
      maxAmount: Number(maxAmount), 
      interestRate: Number(interestRate) 
    } : undefined;
    
    // FIX: Include lenderProfile in User creation
    const user = new User({ name,email,password:hashed,role,kyc,lenderProfile }); 
    
    await user.save();
    res.json({msg:'registered'});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

// Login
authRouter.post('/login', async (req,res)=>{
  const { email,password } = req.body;
  const user = await User.findOne({ email });
  if(!user) return res.status(400).json({msg:'invalid'});
  const ok = await bcrypt.compare(password,user.password);
  if(!ok) return res.status(400).json({msg:'invalid'});
  
  // FIX: Include role in the JWT payload
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secretkey'); 
  
  res.json({ token, user: { id:user._id, name:user.name, role:user.role } });
});


// --- ROUTES: /api/loans (from routes/loans.js) ---
const loansRouter = express.Router();

// Borrower creates a loan request
loansRouter.post('/create', auth, async (req,res)=>{
  if(req.user.role !== 'borrower') return res.status(403).json({msg:'Only borrower'});
  
  // FIX: Add KYC Verification Check
  if(!req.user.kyc.verified) return res.status(403).json({msg:'KYC not verified. Cannot create loan request.'});
  
  const { amount, interestRate, periodMonths } = req.body;
  const loan = new LoanRequest({ borrower: req.user._id, amount, interestRate, periodMonths });
  await loan.save();
  // Try automatic matching
  const matched = await matcher.tryMatch(loan);
  res.json({ loan, matched });
});

// Lender sees open borrower requests
loansRouter.get('/open', auth, async (req,res)=>{
  if(req.user.role !== 'lender') return res.status(403).json({msg:'Only lender'});
  const loans = await LoanRequest.find({ status: 'open' }).populate('borrower','name kyc');
  res.json(loans);
});

// Lender expresses interest (manual)
loansRouter.post('/:id/interest', auth, async (req,res)=>{
  if(req.user.role !== 'lender') return res.status(403).json({msg:'Only lender'});
  const loan = await LoanRequest.findById(req.params.id);
  if(!loan) return res.status(404).json({msg:'not found'});
  loan.matchedWith = req.user._id;
  loan.status = 'matched';
  await loan.save();
  res.json({ msg: 'matched, waiting for acceptance' });
});

// Accept by borrower/lender after match
loansRouter.post('/:id/respond', auth, async (req,res)=>{
  const { action } = req.body; // 'accept' or 'reject'
  const loan = await LoanRequest.findById(req.params.id);
  if(!loan) return res.status(404).json({msg:'not found'});

  if(req.user.role === 'borrower' && loan.borrower.toString() === req.user._id.toString()){
    loan.borrowerAccepted = (action === 'accept');
  }
  if(req.user.role === 'lender' && loan.matchedWith?.toString() === req.user._id.toString()){
    loan.lenderAccepted = (action === 'accept');
  }

  // finalize
  if(loan.borrowerAccepted && loan.lenderAccepted){
    loan.status = 'accepted';
  } else if(action === 'reject'){
    // FIX: If either rejects, reset for potential new match
    loan.status = 'open'; 
    loan.matchedWith = undefined; 
    loan.borrowerAccepted = false;
    loan.lenderAccepted = false;
  }
  await loan.save();
  res.json(loan);
});


// --- ROUTES: /api/admin (from routes/admin.js) ---
const adminRouter = express.Router();

// Admin: view all requests
adminRouter.get('/requests', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({msg:'admin only'});
  const all = await LoanRequest.find().populate('borrower matchedWith');
  res.json(all);
});

// Admin: mark KYC verified
adminRouter.post('/kyc/:userId/verify', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({msg:'admin only'});
  await User.findByIdAndUpdate(req.params.userId,{ 'kyc.verified': true });
  res.json({msg:'verified'});
});


// --- APP USES ROUTES ---
app.use('/api/auth', authRouter);
app.use('/api/loans', loansRouter);
app.use('/api/admin', adminRouter);


// --- SERVER START ---
app.listen(PORT, ()=> console.log('Server running', PORT));

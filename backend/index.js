# LoanPlatform — Fullstack (Node.js + Express + MongoDB) + React

This repository contains a fullstack scaffold for the loan platform you described: 3 stakeholders (admin, lender, borrower), KYC profile creation, manual admin review, automatic matching, and both manual and automatic accept/reject flows.

> **Tech stack**
>
> * Backend: Node.js + Express + Mongoose (MongoDB)
> * Auth: JWT
> * File uploads (KYC): multer (stores files locally in `uploads/` — production: use S3)
> * Frontend: React (create-react-app style, plain JS)

---

## Project layout (suggested)

```
loan-platform/
├─ backend/
│  ├─ package.json
│  ├─ server.js
│  ├─ config/
│  │  └─ db.js
│  ├─ models/
│  │  ├─ User.js
│  │  └─ LoanRequest.js
│  ├─ routes/
│  │  ├─ auth.js
│  │  ├─ loans.js
│  │  └─ admin.js
│  ├─ middleware/
│  │  └─ auth.js
│  ├─ utils/
│  │  └─ matcher.js
│  └─ uploads/
└─ frontend/
   ├─ package.json
   └─ src/
      ├─ index.js
      ├─ App.js
      ├─ services/api.js
      ├─ pages/
      │  ├─ Login.js
      │  ├─ Register.js
      │  ├─ Dashboard.js
      │  ├─ BorrowerRequest.js
      │  ├─ LenderDashboard.js
      │  ├─ AdminDashboard.js
      │  └─ Policies.js
      └─ components/
         └─ Navbar.js
```

---

## Backend — key files

### `backend/package.json`

```json
{
  "name": "loan-platform-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^7.0.0",
    "multer": "^1.4.5"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

---

### `backend/config/db.js`

```js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/loan_platform');
    console.log('MongoDB connected');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
module.exports = connectDB;
```

---

### `backend/models/User.js`

```js
const mongoose = require('mongoose');

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

module.exports = mongoose.model('User', UserSchema);
```

---

### `backend/models/LoanRequest.js`

```js
const mongoose = require('mongoose');

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

module.exports = mongoose.model('LoanRequest', LoanRequestSchema);
```

---

### `backend/middleware/auth.js`

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req,res,next){
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
```

---

### `backend/routes/auth.js`

```js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const User = require('../models/User');

const upload = multer({ dest: 'uploads/' });

// Register (with optional role)
router.post('/register', upload.fields([{name:'pan'},{name:'aadhaar'},{name:'idProof'}]), async (req,res)=>{
  try{
    const { name,email,password,role } = req.body;
    const hashed = await bcrypt.hash(password,10);
    const kyc = {
      pan: req.files?.pan?.[0]?.filename,
      aadhaar: req.files?.aadhaar?.[0]?.filename,
      idProof: req.files?.idProof?.[0]?.filename,
      verified: false
    };
    const user = new User({ name,email,password:hashed,role,kyc });
    await user.save();
    res.json({msg:'registered'});
  }catch(e){
    res.status(400).json({error:e.message});
  }
});

// Login
router.post('/login', async (req,res)=>{
  const { email,password } = req.body;
  const user = await User.findOne({ email });
  if(!user) return res.status(400).json({msg:'invalid'});
  const ok = await bcrypt.compare(password,user.password);
  if(!ok) return res.status(400).json({msg:'invalid'});
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secretkey');
  res.json({ token, user: { id:user._id, name:user.name, role:user.role } });
});

module.exports = router;
```

---

### `backend/routes/loans.js`

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');
const matcher = require('../utils/matcher');

// Borrower creates a loan request
router.post('/create', auth, async (req,res)=>{
  if(req.user.role !== 'borrower') return res.status(403).json({msg:'Only borrower'});
  const { amount, interestRate, periodMonths } = req.body;
  const loan = new LoanRequest({ borrower: req.user._id, amount, interestRate, periodMonths });
  await loan.save();
  // Try automatic matching
  const matched = await matcher.tryMatch(loan);
  res.json({ loan, matched });
});

// Lender sees open borrower requests
router.get('/open', auth, async (req,res)=>{
  if(req.user.role !== 'lender') return res.status(403).json({msg:'Only lender'});
  const loans = await LoanRequest.find({ status: 'open' }).populate('borrower','name kyc');
  res.json(loans);
});

// Lender expresses interest (manual)
router.post('/:id/interest', auth, async (req,res)=>{
  if(req.user.role !== 'lender') return res.status(403).json({msg:'Only lender'});
  const loan = await LoanRequest.findById(req.params.id);
  if(!loan) return res.status(404).json({msg:'not found'});
  loan.matchedWith = req.user._id;
  loan.status = 'matched';
  await loan.save();
  res.json({ msg: 'matched, waiting for acceptance' });
});

// Accept by borrower/lender after match
router.post('/:id/respond', auth, async (req,res)=>{
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
    loan.status = 'rejected';
  }
  await loan.save();
  res.json(loan);
});

module.exports = router;
```

---

### `backend/routes/admin.js`

```js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');

// Admin: view all requests
router.get('/requests', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({msg:'admin only'});
  const all = await LoanRequest.find().populate('borrower matchedWith');
  res.json(all);
});

// Admin: mark KYC verified
router.post('/kyc/:userId/verify', auth, async (req,res)=>{
  if(req.user.role !== 'admin') return res.status(403).json({msg:'admin only'});
  await User.findByIdAndUpdate(req.params.userId,{ 'kyc.verified': true });
  res.json({msg:'verified'});
});

module.exports = router;
```

---

### `backend/utils/matcher.js`

```js
const LoanRequest = require('../models/LoanRequest');
const User = require('../models/User');

// Very simple matching: find lenders whose maxAmount >= amount and interestRate <= borrower's interest
module.exports.tryMatch = async function(loan){
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
```

---

### `backend/server.js`

```js
require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./config/db');
connectDB();
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log('Server running', PORT));
```

---

## Frontend — key files (React)

### `frontend/package.json`

```json
{
  "name": "loan-platform-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.11.2",
    "axios": "^1.4.0"
  },
  "scripts": {
    "start": "react-scripts start"
  }
}
```

---

### `frontend/src/services/api.js`

```js
import axios from 'axios';
const API = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' });
export default API;
```

---

### `frontend/src/pages/Register.js` (simplified)

```js
import React, {useState} from 'react';
import API from '../services/api';

export default function Register(){
  const [form,setForm] = useState({name:'',email:'',password:'',role:'borrower'});
  const filesRef = {};
  const submit = async e=>{
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k,v])=> fd.append(k,v));
    if(filesRef.pan) fd.append('pan', filesRef.pan.files[0]);
    if(filesRef.aadhaar) fd.append('aadhaar', filesRef.aadhaar.files[0]);
    if(filesRef.idProof) fd.append('idProof', filesRef.idProof.files[0]);
    await API.post('/auth/register', fd, { headers: {'Content-Type':'multipart/form-data'} });
    alert('registered');
  }
  return (
    <form onSubmit={submit}>
      <input placeholder="name" onChange={e=>setForm({...form,name:e.target.value})} />
      <input placeholder="email" onChange={e=>setForm({...form,email:e.target.value})} />
      <input placeholder="password" type="password" onChange={e=>setForm({...form,password:e.target.value})} />
      <select onChange={e=>setForm({...form,role:e.target.value})}>
        <option value="borrower">Borrower</option>
        <option value="lender">Lender</option>
      </select>
      <div>
        <label>PAN</label><input type="file" ref={r=>filesRef.pan=r} />
        <label>Aadhaar</label><input type="file" ref={r=>filesRef.aadhaar=r} />
        <label>ID Proof</label><input type="file" ref={r=>filesRef.idProof=r} />
      </div>
      <button type="submit">Register</button>
    </form>
  )
}
```

---

### `frontend/src/pages/Login.js` (simplified)

```js
import React, {useState} from 'react';
import API from '../services/api';

export default function Login({onLogin}){
  const [form,setForm]=useState({email:'',password:''});
  const submit = async e=>{
    e.preventDefault();
    const res = await API.post('/auth/login', form);
    localStorage.setItem('token', res.data.token);
    onLogin(res.data.user);
  }
  return (
    <form onSubmit={submit}>
      <input onChange={e=>setForm({...form,email:e.target.value})} placeholder="email" />
      <input type="password" onChange={e=>setForm({...form,password:e.target.value})} placeholder="password" />
      <button>Login</button>
    </form>
  )
}
```

---

### `frontend/src/pages/BorrowerRequest.js`

```js
import React, {useState} from 'react';
import API from '../services/api';

export default function BorrowerRequest(){
  const [f,setF]=useState({ amount:'', interestRate:'', periodMonths:'' });
  const submit = async e=>{
    e.preventDefault();
    const token = localStorage.getItem('token');
    await API.post('/loans/create', f, { headers:{ Authorization: `Bearer ${token}` } });
    alert('request created');
  }
  return (
    <form onSubmit={submit}>
      <input placeholder="amount" onChange={e=>setF({...f,amount:e.target.value})} />
      <input placeholder="desired interest" onChange={e=>setF({...f,interestRate:e.target.value})} />
      <input placeholder="period months" onChange={e=>setF({...f,periodMonths:e.target.value})} />
      <button>Create</button>
    </form>
  )
}
```

---

### `frontend/src/pages/

// =============================================
// 🥭 MAANGO BACKEND — server.js
// Deploy on: Render.com (Free Tier)
// =============================================

const express    = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors       = require('cors');

const app = express();

// Parse JSON with 10MB limit (for Base64 KYC file uploads)
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// ===== SUPABASE CONFIG =====
// Set these in Render Environment Variables:
//   SUPABASE_URL  = https://your-project.supabase.co
//   SUPABASE_KEY  = your-service-role-key (secret)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_KEY environment variable is missing!');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== HEALTH CHECK =====
app.get('/', (req, res) => {
  res.json({
    status: "online",
    message: "Maango API is running.",
    version: "1.0.0"
  });
});

// ===== REGISTER USER =====
// Called when a new user signs up
app.post('/api/users/register', async (req, res) => {
  const { id, name, email, country, user_type } = req.body;

  if (!id || !name || !email || !country || !user_type) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const { data, error } = await supabase
    .from('users')
    .insert([{ id, name, email, country, user_type }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "User registered.", data });
});

// ===== KYC DOCUMENT UPLOAD =====
// Receives Base64 file, uploads to Supabase Storage bucket 'kyc-documents'
app.post('/api/users/kyc-upload', async (req, res) => {
  const { userId, docType, docNumber, fileBase64, fileName } = req.body;

  if (!userId || !docType || !docNumber || !fileBase64) {
    return res.status(400).json({ error: "Missing required KYC parameters." });
  }

  try {
    // Convert Base64 → Buffer
    const buffer   = Buffer.from(fileBase64, 'base64');
    const filePath = `${userId}/${Date.now()}-${fileName}`;

    // Upload to Supabase Storage
    const { error: storageError } = await supabase
      .storage
      .from('kyc-documents')
      .upload(filePath, buffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (storageError) throw new Error("Storage: " + storageError.message);

    // Mark user as KYC verified in DB
    const { error: dbError } = await supabase
      .from('users')
      .update({ govt_id_verified: true, govt_id_type: docType, govt_id_number: docNumber })
      .eq('id', userId);

    if (dbError) throw new Error("Database: " + dbError.message);

    res.status(200).json({ message: "KYC document uploaded & verified!", path: filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== CREATE ESCROW CONTRACT =====
// Only accessible to verified Experts in the frontend
app.post('/api/contracts/create', async (req, res) => {
  const { buyer_ref, farmer_ref, expert_id, expert_name, crop_details, escrow_amount } = req.body;

  if (!buyer_ref || !farmer_ref || !expert_id || !crop_details || !escrow_amount) {
    return res.status(400).json({ error: "Incomplete contract data." });
  }

  const contract_id = 'MNG-' + Math.floor(Math.random() * 90000 + 10000);

  const { data, error } = await supabase
    .from('contracts')
    .insert([{
      contract_id,
      buyer_ref,
      farmer_ref,
      expert_id,
      expert_name,
      crop_details,
      escrow_amount,
      status: 'Escrow Locked 🔒'
    }])
    .select();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: "Contract locked in escrow.", data });
});

// ===== GET ALL CONTRACTS =====
app.get('/api/contracts', async (req, res) => {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Maango Backend running on port ${PORT}`);
});

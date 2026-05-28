const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

// 🚨 ENTERPRISE FIX: Base64 files heavy hoti hain, isliye limit 10MB karni zaroori hai
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// 🚨 YAHAN CHANGE KIYA HAI: Hardcoded key hata di aur process.env laga diya
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ymuvafzrmhxilzyladwq.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_KEY; 

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

app.get('/', (req, res) => {
    res.json({ status: "online", message: "Maango API running directly via GitHub + Render." });
});

app.post('/api/users/register', async (req, res) => {
    const { id, name, email, country, user_type } = req.body;
    if (!id || !name || !email || !country || !user_type) {
        return res.status(400).json({ error: "Missing required fields." });
    }
    const { data, error } = await supabase.from('users').insert([{ id, name, email, country, user_type }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "User saved in Supabase.", data });
});

app.post('/api/contracts/create', async (req, res) => {
    const { buyer_ref, farmer_ref, expert_id, expert_name, crop_details, escrow_amount } = req.body;
    if (!buyer_ref || !farmer_ref || !expert_id || !crop_details || !escrow_amount) {
        return res.status(400).json({ error: "Incomplete metadata." });
    }
    const contract_id = 'MNG-' + Math.floor(Math.random() * 90000 + 10000);
    const { data, error } = await supabase.from('contracts').insert([{
        contract_id, buyer_ref, farmer_ref, expert_id, expert_name, crop_details, escrow_amount, status: 'Escrow Locked 🔒'
    }]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ message: "Escrow locked.", data });
});

app.get('/api/contracts', async (req, res) => {
    const { data, error } = await supabase.from('contracts').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// ===== 6. SECURE DOCUMENT KYC UPLOAD API =====
app.post('/api/users/kyc-upload', async (req, res) => {
    const { userId, docType, docNumber, fileBase64, fileName } = req.body;

    if (!userId || !docType || !docNumber || !fileBase64) {
        return res.status(400).json({ error: "Missing required KYC parameters or file data." });
    }

    try {
        // Base64 text ko asli file buffer mein convert karo
        const buffer = Buffer.from(fileBase64, 'base64');
        
        // Secure file path banao (User ID ke folder ke andar file save hogi)
        const filePath = `${userId}/${Date.now()}-${fileName}`;

        // 1. Pucho file ko Supabase Secure 'kyc-documents' Bucket mein
        const { data: storageData, error: storageError } = await supabase
            .storage
            .from('kyc-documents')
            .upload(filePath, buffer, {
                contentType: 'image/jpeg', // Standard image fallback
                upsert: true
            });

        if (storageError) throw new Error("Storage Upload Failed: " + storageError.message);

        // 2. Database mein user ka verification status 'TRUE' update karo
        const { error: dbError } = await supabase
            .from('users')
            .update({ govt_id_verified: true })
            .eq('id', userId);

        if (dbError) throw new Error("Database Update Failed: " + dbError.message);

        res.status(200).json({ 
            message: "KYC Document locked in vault successfully!", 
            path: filePath 
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🚨 SERVER START HAMESHA SABSE LAST MEIN HOTA HAI 🚨
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Engine running on port ${PORT}`); });

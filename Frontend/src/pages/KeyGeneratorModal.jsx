// import React, { useState } from "react";
// import api from "../api/axios";

// export default function KeyGeneratorModal({ onClose }) {
//   const [generatedKey, setGeneratedKey] = useState("");
//   const [copied, setCopied] = useState(false);
//   const [loading, setLoading] = useState(false);

//   const handleGenerate = async () => {
//     try {
//       setLoading(true);
//       const res = await api.post("/system/generate-key");
//       setGeneratedKey(res.data.activation_key);
//       setCopied(false);
//     } catch (error) {
//       console.error("Failed to generate key", error);
//       alert("Error generating activation key.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleCopy = () => {
//     navigator.clipboard.writeText(generatedKey);
//     setCopied(true);
//   };

//   return (
//     <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
//       <div style={{ background: '#131c31', border: '1px solid rgba(255,255,255,0.1)', padding: '30px', borderRadius: '16px', width: '420px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', color: 'white', fontFamily: 'sans-serif' }}>
//         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
//           <h3 style={{ margin: 0, color: '#38bdf8' }}>License Key Generator</h3>
//           <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
//         </div>

//         <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>
//           Generate brand new 14-digit alphanumeric activation keys on demand for your clients. You can generate keys repeatedly.
//         </p>

//         {generatedKey ? (
//           <div style={{ marginBottom: '20px' }}>
//             <input 
//               type="text" 
//               readOnly 
//               value={generatedKey} 
//               style={{ width: '100%', padding: '12px', background: '#0f172a', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '8px', textAlign: 'center', fontSize: '18px', letterSpacing: '2px', fontWeight: 'bold', boxSizing: 'border-box' }}
//             />
//             <button 
//               onClick={handleCopy} 
//               style={{ width: '100%', marginTop: '10px', padding: '10px', background: copied ? '#10b981' : '#334155', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
//             >
//               {copied ? '✓ Copied to Clipboard!' : 'Copy Key'}
//             </button>
//           </div>
//         ) : null}

//         <button 
//           onClick={handleGenerate} 
//           disabled={loading}
//           style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)', color: '#0f172a', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
//         >
//           {loading ? 'Generating...' : 'Generate New Key 🔑'}
//         </button>
//       </div>
//     </div>
//   );
// }
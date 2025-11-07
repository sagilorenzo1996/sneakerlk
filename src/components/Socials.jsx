// src/components/Socials.jsx

const Socials = () => (
    <>
      <h2>CONNECT WITH US</h2>
      <p style={{ textAlign: 'center', fontSize: '1.2em', marginBottom: '40px' }}>
        We do business where you live! **DM us to secure a sale.**
      </p>
      <div className="social-links" style={{ marginTop: '20px' }}>
        <a href="https://wa.me/YOUR_WHATSAPP_NUMBER" target="_blank" title="WhatsApp">📱 WhatsApp</a>
        <a href="YOUR_INSTAGRAM_LINK" target="_blank" title="Instagram">📸 Instagram</a>
        <a href="YOUR_TIKTOK_LINK" target="_blank" title="TikTok">💃 TikTok</a>
        <a href="YOUR_FACEBOOK_LINK" target="_blank" title="Facebook">📘 Facebook</a>
      </div>
      <p style={{ marginTop: '30px', fontSize: '1.2em', fontWeight: 'bold', color: 'var(--accent-color)' }}>
        **90% of our sales are finalized via WhatsApp!** Click the green button above!
      </p>
    </>
  );
  
  export default Socials;
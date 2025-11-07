// src/components/PreorderForm.jsx
import { useState } from 'react';

const PreorderForm = () => {
  const [message, setMessage] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    
    const name = form.elements.name.value;
    const model = form.elements.shoe_model.value;
    const phone = form.elements.phone.value;

    // Simulate form submission logic
    setMessage(`**SUCCESS!** Thanks, ${name}! We'll contact you on ${phone} about the ${model} ASAP!`);
    
    // Clear the form
    form.reset(); 
    setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
  };

  return (
    <>
      <h2>📦 PRE-ORDER YOUR GRAIL KICKS 📦</h2>
      <p style={{ textAlign: 'center', fontSize: '1.2em', marginBottom: '20px' }}>
        Want a specific pair or size not listed? Let us import it for you!
      </p>
      
      <form id="preorder-form" onSubmit={handleSubmit}>
        <h3>PRE-ORDER REQUEST FORM</h3>
        
        <input type="text" name="name" placeholder="Your Full Name" required />
        <input type="tel" name="phone" placeholder="WhatsApp Number" required />
        <input type="email" name="email" placeholder="Email (Optional)" />
        <input type="text" name="shoe_model" placeholder="Exact Shoe Model/Name" required />
        
        <select name="size" required>
          <option value="">Select Your Size (US)</option>
          <option value="US 7">US 7</option>
          <option value="US 8">US 8</option>
          <option value="US 9">US 9</option>
          <option value="US 10">US 10</option>
          <option value="US 11">US 11</option>
          <option value="US 12">US 12</option>
          {/* UK Sizes */}
          <option value="">Select Your Size (UK)</option>
          <option value="UK 6">UK 6</option>
          <option value="UK 7">UK 7</option>
          <option value="UK 8">UK 8</option>
          <option value="UK 9">UK 9</option>
          <option value="UK 10">UK 10</option>
          <option value="UK 11">UK 11</option>
        </select>
        
        <textarea name="details" rows="4" placeholder="Any extra details (e.g., colorway, condition preference)"></textarea>
        
        <button type="submit" className="btn primary-btn">SUBMIT PRE-ORDER REQUEST</button>
        <p id="form-message" style={{ color: 'var(--secondary-color)', marginTop: '10px' }} dangerouslySetInnerHTML={{ __html: message }}></p>
      </form>
      
      <p style={{ marginTop: '40px', fontWeight: 'bold' }}>
        **NOTE:** This form only collects your request. We will contact you on **WhatsApp** to confirm the price and deposit.
      </p>
    </>
  );
};

export default PreorderForm;
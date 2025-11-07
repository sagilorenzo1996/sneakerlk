// src/components/StockGrid.jsx
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import productsCsv from '../../public/products.txt?url'; // Import TXT as a URL

  const whatsappBaseUrl = "https://wa.me/YOUR_WHATSAPP_NUMBER?text=";
  
  const ShoeCard = ({ shoe }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const images = [
      shoe.image1,
      shoe.image2,
      shoe.image3,
      shoe.image4,
    ].filter(Boolean); // Filter out any undefined or null image paths

    const nextImage = (e) => {
      e.stopPropagation(); // Prevent card onClick from firing
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    };

    const prevImage = (e) => {
      e.stopPropagation(); // Prevent card onClick from firing
      setCurrentImageIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length);
    };

    return (
      <div 
        className="shoe-card"
        onClick={() => window.location.href = `${whatsappBaseUrl}${encodeURIComponent(shoe.whatsappText)}`}
      >
        <div style={{ position: 'relative' }}>
          <img src={images[currentImageIndex]} alt={shoe.name} />
        </div>
        {images.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', marginBottom: '15px' }}>
            <button 
              onClick={prevImage}
              className="btn shoe-nav-btn"
              style={{
                flex: 1,
                marginRight: '5px'
              }}
            >
              Prev
            </button>
            <button 
              onClick={nextImage}
              className="btn shoe-nav-btn"
              style={{
                flex: 1,
                marginLeft: '5px'
              }}
            >
              Next
            </button>
          </div>
        )}
        
        <h3>{shoe.name}</h3>
        <p>Sizes: {shoe.sizes}</p>
        <p>Price: {shoe.price}</p>
        <p style={{ color: 'var(--primary-color)' }}>**{shoe.status}**</p>
      </div>
    );
  };
  
  const StockGrid = () => {
    const [products, setProducts] = useState([]);

    useEffect(() => {
      const fetchProducts = async () => {
        const response = await fetch(productsCsv);
        const reader = response.body.getReader();
        const result = await reader.read();
        const decoder = new TextDecoder('utf-8');
        const csv = decoder.decode(result.value);
        const parsedData = Papa.parse(csv, { 
          header: true, 
          dynamicTyping: true, 
          skipEmptyLines: true
        });
        
        const formattedProducts = parsedData.data.map(product => ({
          id: product.name, // Using name as a simple unique ID for now
          name: product.name,
          price: `$${product.price}.00`,
          status: product.status, // Dynamically set status from CSV
          whatsappText: `Inquiring about ${product.name}`,
          image1: product.image1,
          image2: product.image2,
          image3: product.image3,
          image4: product.image4,
        }));

        setProducts(formattedProducts);
      };

      fetchProducts();
    }, []);

    return (
      <>
        <h2>🔥 CURRENTLY AVAILABLE STOCK 🔥</h2>
        <p style={{ textAlign: 'center', fontSize: '1.2em', color: 'var(--secondary-color)' }}>
          These are in stock and ready to ship! First come, first served.
        </p>
        <div className="shoe-grid">
          {products.map(shoe => <ShoeCard key={shoe.id} shoe={shoe} />)}
        </div>
      </>
    );
  };
  
  export default StockGrid;
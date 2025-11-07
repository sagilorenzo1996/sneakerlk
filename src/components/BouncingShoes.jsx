import React, { useEffect, useRef } from 'react';
import '../animations.css'; // Import the CSS for animations

const BouncingShoes = () => {
  const containerRef = useRef(null);
  const shoeCount = 10; // Number of bouncing shoes
  const shoesRef = useRef([]); // To store shoe elements and their state

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = ''; // Clear existing shoes
    shoesRef.current = []; // Clear previous state

    const shoeSize = 50; // px, needs to match CSS

    for (let i = 0; i < shoeCount; i++) {
      const shoe = document.createElement('div');
      shoe.className = 'bouncing-shoe';
      
      // Initial random position and velocity
      const initialLeft = Math.random() * (window.innerWidth - shoeSize);
      const initialTop = Math.random() * (window.innerHeight - shoeSize);
      let velocityX = (Math.random() - 0.5) * 1; // Reduced from 2 to 1
      let velocityY = (Math.random() - 0.5) * 1; // Reduced from 2 to 1
      let rotation = Math.random() * 360; // Initial random rotation
      let rotationSpeed = (Math.random() - 0.5) * 0.5; // Slow rotation speed

      // Ensure a minimum speed to avoid static shoes
      if (Math.abs(velocityX) < 0.2) velocityX = velocityX > 0 ? 0.2 : -0.2; // Adjusted minimum speed
      if (Math.abs(velocityY) < 0.2) velocityY = velocityY > 0 ? 0.2 : -0.2; // Adjusted minimum speed

      shoe.style.left = `${initialLeft}px`;
      shoe.style.top = `${initialTop}px`;
      shoe.style.transform = `rotate(${rotation}deg)`;

      container.appendChild(shoe);
      shoesRef.current.push({ element: shoe, x: initialLeft, y: initialTop, velocityX, velocityY, rotation, rotationSpeed });
    }

    const animate = () => {
      const containerRect = container.getBoundingClientRect();

      shoesRef.current.forEach(shoe => {
        let { x, y, velocityX, velocityY, rotation, rotationSpeed, element } = shoe;

        x += velocityX;
        y += velocityY;
        rotation += rotationSpeed; // Update rotation

        // Collision detection with container edges
        if (x + shoeSize > containerRect.width || x < 0) {
          velocityX *= -1; // Reverse horizontal direction
          x = Math.max(0, Math.min(x, containerRect.width - shoeSize)); // Keep within bounds
        }
        if (y + shoeSize > containerRect.height || y < 0) {
          velocityY *= -1; // Reverse vertical direction
          y = Math.max(0, Math.min(y, containerRect.height - shoeSize)); // Keep within bounds
        }

        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.transform = `rotate(${rotation}deg)`; // Apply rotation

        // Update shoe's state
        shoe.x = x;
        shoe.y = y;
        shoe.velocityX = velocityX;
        shoe.velocityY = velocityY;
        shoe.rotation = rotation; // Update shoe's rotation state
      });

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => cancelAnimationFrame(animate);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none', zIndex: -1 }}>
      {/* Shoes will be injected and animated here by useEffect */}
    </div>
  );
};

export default BouncingShoes;

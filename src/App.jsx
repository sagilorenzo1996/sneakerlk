// src/App.jsx
import Header from './components/Header';
import Socials from './components/Socials';
import StockGrid from './components/StockGrid';
import PreorderForm from './components/PreorderForm';
import BouncingShoes from './components/BouncingShoes';
import logo from '../public/logo.png';

function App() {
  return (
    <div className="scroll-smooth">
      <BouncingShoes />
      <div className="navbar">
        <a href="#hero">HOME</a>
        <a href="#social-proof">SOCIALS</a>
        <a href="#available-stock">STOCK</a>
        <a href="#preorder">PRE-ORDER</a>
        <a className="whatsapp-btn" href="https://wa.me/+94704599664" target="_blank">CHAT NOW (FASTEST)</a>
      </div>

      <section id="hero" className="container">
        <Header />
      </section>
      
      <section id="social-proof" className="container">
        <Socials />
      </section>

      <section id="available-stock" className="container">
        <StockGrid />
      </section>

      <section id="preorder" className="container">
        <PreorderForm />
      </section>

      <footer>
        <img src={logo} alt="Retro Kicks Logo" style={{ height: '100px', marginBottom: '10px' }} />
        <p>&copy; 2025 sneaker.lk. All Rights Reserved. Built with **8-BIT LOVE**.</p>
      </footer>
    </div>
  );
}

export default App;
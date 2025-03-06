import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-neutral-50 border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center space-x-4 text-sm text-neutral-600">
          <Link to="/privacy-policy" className="hover:text-primary-600">
            Política de Privacidad
          </Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-primary-600">
            Términos de Servicio
          </Link>
        </div>
      </div>
    </footer>
  );
} 
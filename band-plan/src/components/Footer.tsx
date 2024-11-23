import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center space-x-4 text-sm text-gray-600">
          <Link to="/privacy-policy" className="hover:text-indigo-600">
            Política de Privacidad
          </Link>
          <span>•</span>
          <Link to="/terms" className="hover:text-indigo-600">
            Términos de Servicio
          </Link>
        </div>
      </div>
    </footer>
  );
} 
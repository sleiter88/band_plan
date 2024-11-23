import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Política de Privacidad</h1>
      
      <div className="prose prose-indigo">
        <p className="mb-4">Última actualización: {new Date().toLocaleDateString()}</p>
        
        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Información que Recopilamos</h2>
          <p>
            Band Manager recopila la siguiente información personal:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Dirección de correo electrónico</li>
            <li>Nombre</li>
            <li>Información de perfil de usuario</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Uso de Permisos</h2>
          <p>Nuestra aplicación requiere ciertos permisos para funcionar correctamente:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>
              <strong>Acceso a Internet:</strong> Necesario para sincronizar datos con nuestros servidores, 
              guardar la información de tu banda y permitir la colaboración entre miembros.
            </li>
            <li>
              <strong>Almacenamiento:</strong> Utilizado para guardar archivos localmente (como partituras, 
              letras de canciones y configuraciones de la aplicación) mejorando así el rendimiento y 
              permitiendo el uso sin conexión.
            </li>
            <li>
              <strong>Notificaciones:</strong> Para mantenerte informado sobre actualizaciones importantes, 
              mensajes de otros miembros de la banda y recordatorios de eventos.
            </li>
            <li>
              <strong>Cámara (opcional):</strong> Solo si decides subir fotos directamente desde la 
              aplicación para tu perfil o contenido de la banda.
            </li>
          </ul>
          <p className="mb-4">
            Todos estos permisos son utilizados exclusivamente para proporcionar y mejorar las 
            funcionalidades de la aplicación. No compartimos ninguna información recopilada a través 
            de estos permisos con terceros.
          </p>
          <p>
            Puedes gestionar estos permisos en cualquier momento a través de la configuración de tu 
            dispositivo. Ten en cuenta que desactivar ciertos permisos puede limitar algunas 
            funcionalidades de la aplicación.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Cómo Utilizamos su Información</h2>
          <p>Utilizamos la información recopilada para:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Proporcionar y mantener nuestro servicio</li>
            <li>Gestionar su cuenta y membresía</li>
            <li>Permitir la participación en funciones interactivas</li>
            <li>Enviar notificaciones relacionadas con el servicio</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. Seguridad de los Datos</h2>
          <p>
            La seguridad de sus datos es importante para nosotros. Utilizamos Supabase 
            como nuestra plataforma de base de datos y autenticación, que implementa 
            estándares de seguridad de la industria para proteger su información personal.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. Sus Derechos</h2>
          <p>Usted tiene derecho a:</p>
          <ul className="list-disc pl-6 mb-4">
            <li>Acceder a sus datos personales</li>
            <li>Corregir datos inexactos</li>
            <li>Solicitar la eliminación de sus datos</li>
            <li>Oponerse al procesamiento de sus datos</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Contacto</h2>
          <p>
            Si tiene preguntas sobre esta Política de Privacidad, puede contactarnos en:
            <br />
            <a href="mailto:privacy@bandmanager.com" className="text-indigo-600 hover:text-indigo-800">
              privacy@bandmanager.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
} 
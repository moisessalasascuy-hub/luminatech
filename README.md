# LuminaTech

Sitio corporativo con catálogo de servicios, carrito de compras, flujo de pago, formulario de contacto y panel administrativo con base de datos SQLite.

## Requisitos

- Node.js 20 o superior
- npm

## Instalación

```bash
npm install
```

## Ejecución

```bash
npm start
```

El comando inicia el servidor y abre la página en el navegador predeterminado. También puedes abrir estas direcciones manualmente:

- http://localhost:3000
- http://localhost:3000/admin.html

Para iniciar el servidor sin abrir el navegador, usa `npm run start:server`.

## Uso en otro ordenador

Instala Node.js 20 o superior, copia la carpeta del proyecto, ejecuta `npm install` y después `npm start`. No abras `index.html` directamente: la página necesita el servidor para guardar contactos y pedidos. Para probarlo desde otro equipo conectado a la misma red, usa la dirección `Acceso desde la red` que muestra el servidor.

SQLite crea `data/luminatech.sqlite` automáticamente y guarda los datos en el ordenador donde se ejecuta el servidor. Cada instalación tiene su propia base de datos.

### Publicar en Internet con un enlace estable

El túnel `trycloudflare.com` de la sección siguiente es temporal: su dirección puede cambiar y deja de funcionar al cerrar el programa. Para que la web esté disponible aunque este ordenador esté apagado, el proyecto incluye [render.yaml](./render.yaml) para desplegarlo en Render con un disco persistente para SQLite.

El servicio configurado usa el plan Starter de Render y un disco persistente de 1 GB; ambos pueden tener coste. El disco conserva contactos y pedidos entre reinicios y despliegues, y Render crea snapshots diarios. El enlace `onrender.com` se mantiene mientras el servicio y la cuenta sigan activos, pero ningún hosting garantiza disponibilidad indefinida.

1. Crea un repositorio **privado y vacío** en GitHub. Abre PowerShell en esta carpeta y sube el proyecto con Git (sustituye la URL por la de tu repositorio):

   ```powershell
   git init
   git add .
   git commit -m "Preparar LuminaTech para Render"
   git branch -M main
   git remote add origin https://github.com/USUARIO/NOMBRE-REPO.git
   git push -u origin main
   ```

   `.gitignore` excluye la base de datos local para que no publiques los datos que contiene.
2. En Render, crea un **Blueprint** y conecta ese repositorio. Render leerá `render.yaml`; confirma la creación del servicio y revisa el coste mostrado antes de aceptar.
3. Cuando el despliegue termine, abre la URL `onrender.com` que muestra Render. El panel está en `/admin.html`; la contraseña aleatoria se encuentra en la variable `ADMIN_PASSWORD` de la configuración del servicio en Render.

La base de datos actual de este ordenador no se copia automáticamente: el despliegue comienza con una base de datos nueva en el disco persistente. Guarda la base local por separado si necesitas conservar esos registros. No compartas la contraseña del panel junto con el enlace público.

### Compartir temporalmente por Internet (Windows)

Con `cloudflared` instalado, abre una terminal en la carpeta del proyecto y ejecuta:

```powershell
$env:PUBLIC_SHARE = '1'
$env:ADMIN_PASSWORD = (New-Guid).ToString()
npm run start:server
```

En una segunda terminal, ejecuta `cloudflared tunnel --url http://localhost:3000` y comparte la dirección HTTPS `trycloudflare.com` que aparezca. Mantén ambas terminales abiertas mientras revisan el sitio; al cerrarlas, el enlace deja de funcionar. El panel `/admin.html` pedirá la contraseña generada arriba. Comparte esa clave por separado y solo con el profesor.

## Funcionalidades

- Página principal con navegación SPA
- Catálogo de servicios y productos
- Carrito con cálculo total
- Registro de pedidos de demostración, sin cobros
- Envío de formularios a la API
- Persistencia en SQLite
- Panel administrativo con contactos, pedidos y eventos

## API principal

- `POST /api/contacts`
- `POST /api/orders`
- `POST /api/events`
- `GET /api/admin/data`

## Base de datos

La base de datos se guarda en:

- `data/luminatech.sqlite`

## Pagos

No hay una pasarela real conectada. El checkout solo acepta los valores ficticios mostrados en el formulario y guarda la compra, el importe, las iniciales del comprador, los últimos cuatro dígitos (`4242`) y el vencimiento. El número completo y el CVV no se guardan; no introduzcas datos reales. Los pedidos quedan como `paid_demo` (“Pago realizado (prueba)”) y no realizan cobros. Para aceptar pagos reales hay que integrar Stripe, PayPal u otro proveedor en su modo de pruebas.

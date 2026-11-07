<div align="center">

# 🥃 ONYX — Fallen Ash Realm (FAR)

*«Las cuentas claras y el plomo bajo la mesa.»*

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue?style=for-the-badge&logo=discord.js)](https://discord.js.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![OpenRouter](https://img.shields.io/badge/AI-OpenRouter-orange?style=for-the-badge)](https://openrouter.ai/)

</div>

---

## 🕶️ ¿Qué es Onyx?

**Onyx** es el bot oficial de gestión, seguridad y economía clandestina operado en el bar **Fallen Ash Realm (FAR)**. Diseñado bajo una estética de mafia y bajo mundo, opera de forma estricta utilizando **Euros (`€`)** como moneda oficial, integrando sistemas financieros avanzados, automatización de bases de datos y respuestas tácticas mediante inteligencia artificial.

---

## 🛠️ Características Principales

* **💼 Sistema Financiero y Pestaña (`/botin`):**
  * Consulta de balances individuales o de terceros (`/botin saldo`).
  * Transferencias directas de dinero "bajo la mesa" entre usuarios con validación de fondos (`/botin transfer`).
  * Gestión administrativa avanzada para inyectar/sumar (`/botin debitar`) o confiscar fondos (`/botin cobrar`) con autocompletado en tiempo real de saldos.
* **🚨 Pizarra de los Más Buscados (`/most-wanted`):**
  * Ranking interactivo dinámico que extrae el nombre del servidor actual.
  * Paginación fluida mediante botones de navegación (`◀️` / `▶️`) para manejar listas extensas de gángsters.
* **🛒 Mercado Negro y Contrabando (`/tienda`):**
  * Catálogo de artículos interactivo con paginación y menús desplegables de compra instantánea.
  * Control riguroso de **stock limitado**: al agotarse las unidades, el objeto desaparece de la base de datos.
  * Asignación automática opcional de roles de Discord al adquirir productos.
* **💸 Impuestos y Cuota de Protección (Sistema Automatizado):**
  * Recaudación periódica automática de un 2% semanal sobre el capital estancado para mantener la economía del servidor en movimiento.
* **🤖 IA Táctica Integrada:**
  * Interacción fluida mediante menciones en el chat potenciada por OpenRouter para responder con la personalidad inconfundible de Onyx.
* **🛡️ Purga Global de Servidores:**
  * Limpieza automática de registros en MongoDB si el bot es expulsado de un servidor, optimizando el espacio y manteniendo la privacidad.

---

## 📁 Estructura del Directorio

```text
📦 Onyx
 ┣ 📂 Commands          # Comandos de barra (Slash Commands)
 ┣ 📂 Config            # Archivos de configuración y constantes
 ┣ 📂 Mongodb           # Modelos de Mongoose y lógica de bases de datos
 ┣ 📂 Services          # Servicios externos (OpenRouter, rutinas autónomas, sincronización cloud)
 ┣ 📜 clean-commands.js # Script de limpieza de comandos de Discord
 ┣ 📜 deploy-commands.js# Despliegue automático de slash commands
 ┣ 📜 index.js          # Núcleo del bot, servidor web Express y tareas programadas
 ┗ 📜 package.json      # Dependencias del proyecto

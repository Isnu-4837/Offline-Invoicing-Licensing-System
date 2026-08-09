# 🧾 Offline-Invoicing-Licensing-System

An enterprise-grade, cross-platform desktop invoicing and inventory management system designed for offline-first environments, featuring built-in product activation security and machine locking.

---

## 🚀 Key Features

* **Complete Invoicing & ERP Suite:** Manage professional invoices, purchase tracking, inventory levels, and automated stock alerts.
* **Offline Product Licensing & Security:** Built-in cryptographic license key validation to prevent unauthorized software distribution and enforce machine locking.
* **Modern Cross-Platform Architecture:** Powered by **Electron** for native desktop deployment, wrapped around a high-performance **FastAPI** Python backend and a responsive **React** UI.
* **Relational Local Database:** Utilizes **SQLite** for robust, zero-configuration local data persistence.

---

## 🛠️ Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, Axios
* **Backend:** Python, FastAPI, Uvicorn, SQLAlchemy
* **Desktop Wrapper & Packaging:** Electron, electron-builder
* **Database:** SQLite

---

## 📂 Project Structure

```text
Offline-Invoicing-Licensing-System/
├── Backend/                 # FastAPI REST API, database models, and licensing logic
├── Frontend/                # React dashboard and user interface views
├── Electron Invoice/        # Electron main container process & configuration
├── Electron KeyGenerator/   # Standalone administrative key generation utility
└── README.md                # Project documentation

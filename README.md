
# Inventoz


Inventory-Helper is a comprehensive solution designed to streamline the process of managing inventory for your business. This project includes features for adding, updating, and tracking products, along with managing brands, categories, and conditions of products.

## Table of Contents
- [Features](#features)
- [Installation](#installation)
- [Technologies Used](#technologies-used)
- [Contributing](#contributing)


## Features

- **Product Management**: Add, update, and delete products.
- **Inbound Management**: Track and manage inbound product shipments.
- **Brand Management**: Manage brands and their associated metadata.
- **Category Management**: Manage product categories.
- **Condition Management**: Define and manage product conditions.

## Installation

To get started with Inventory-Helper, follow these steps:

1. **Clone the repository:**

   ```bash
   git checkout DB-MAY-2024

2. **Switch to the latest branch**
   ```bash
   git clone https://github.com/OsbanCerejo/Inventory-Helper.git
   cd Inventory-Helper

4. **Install dependencies**
   ```bash
   npm install

6. **Set up the database**
   
   Configure your database settings in config.js or equivalent configuration file.

8. **Run the Front end**

   Navigate to the front end directory in the terminal window and run the start command
   ```bash
   cd frontend/inventory-helper
   npm run dev
9. **Run the Back end**
    Navigate to the backend in another terminal and start the backend
     ```bash
    cd backend
    npm start

## Technologies Used
- Backend: Node.js, Express.js
- Database: Sequelize ORM, MySQL
- Frontend: React.js
- Other: Axios, Toast notifications for user feedback

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. Fork the repository.
2. Create a new branch with a descriptive name.
3. Make your changes.
4. Test your changes thoroughly.
5. Submit a pull request with a description of your changes.

const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Authentication API",
      version: "1.0.0",
    },
  },
  apis: ["./routes/auth-routes.js"], // Path to your routes with Swagger annotations
};

const openapiSpecification = swaggerJsdoc(options);
console.log(JSON.stringify(openapiSpecification, null, 2));


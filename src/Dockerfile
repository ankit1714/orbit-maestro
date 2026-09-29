# Use a modern, lightweight Node.js version
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Now, copy the rest of your application source code (including the 'public' folder)
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Set Node.js options for memory management in Cloud Run
ENV NODE_OPTIONS=--max-old-space-size=1500

# Start the application using your package.json's "start" script
CMD [ "npm", "start" ]

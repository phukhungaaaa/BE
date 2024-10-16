# Sử dụng Node.js phiên bản 18 với Alpine Linux làm base image
FROM node:18-alpine

# Cài đặt các thư viện phụ thuộc cần thiết cho canvas
RUN apk add --no-cache \
    libcairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    build-base \
    python3 \
    py3-pip

# Tạo thư mục làm việc
WORKDIR /app

# Sao chép tệp package.json và package-lock.json (nếu có) vào thư mục làm việc
COPY package*.json ./
COPY .env* ./
COPY key.json ./

# Sao chép tất cả các tệp trong thư mục src vào thư mục làm việc
COPY src ./src
COPY main.js ./

# Cài đặt các phụ thuộc
RUN npm install

# Mở cổng 5001
EXPOSE 5001

# Chạy ứng dụng
CMD ["npm", "run", "deploy"]
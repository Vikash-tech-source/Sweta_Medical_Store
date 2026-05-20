import os
import json
import base64
import random
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Configuration
PORT = 8000
ADMIN_PASSCODE = "SWETA2026"
DATA_DIR = "data"
UPLOAD_DIR = "uploads"
PRODUCTS_FILE = os.path.join(DATA_DIR, "products.json")
ORDERS_FILE = os.path.join(DATA_DIR, "orders.json")

# Ensure required directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("public", exist_ok=True)
os.makedirs("public/css", exist_ok=True)
os.makedirs("public/js", exist_ok=True)

# Helper function to read JSON
def read_json_file(filepath, default_val=None):
    if not os.path.exists(filepath):
        return default_val if default_val is not None else []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return default_val if default_val is not None else []

# Helper function to write JSON
def write_json_file(filepath, data):
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False

# MIME type mapping
MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".pdf": "application/pdf"
}

class SwetaMedicalHandler(BaseHTTPRequestHandler):
    
    def log_message(self, format, *args):
        # Override to keep terminal logging clean
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {format%args}")

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def send_error_response(self, message, status_code=400):
        self.send_json_response({"error": message}, status_code)

    def verify_admin(self):
        passcode = self.headers.get("X-Admin-Passcode")
        if passcode == ADMIN_PASSCODE:
            return True
        self.send_error_response("Unauthorized: Invalid Admin Passcode", 401)
        return False

    def do_OPTIONS(self):
        # Handle CORS preflight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        query_params = parse_qs(parsed_url.query)

        # ------------------ API ENDPOINTS ------------------
        if path == "/api/products":
            # GET /api/products (Retrieve Inventory)
            products = read_json_file(PRODUCTS_FILE, [])
            self.send_json_response(products, 200)
            return

        elif path == "/api/orders":
            # GET /api/orders (Seller dashboard fetch or Buyer tracking fetch)
            tracker_id = query_params.get("trackerId", [None])[0]
            orders = read_json_file(ORDERS_FILE, [])
            
            if tracker_id:
                # Order tracking request (does not require passcode)
                matching_orders = [o for o in orders if o.get("trackerId", "").upper() == tracker_id.upper()]
                if matching_orders:
                    self.send_json_response(matching_orders[0], 200)
                else:
                    self.send_error_response("Order not found", 404)
            else:
                # Full admin order view (requires passcode)
                if self.verify_admin():
                    self.send_json_response(orders, 200)
            return

        # ------------------ STATIC FILES SERVING ------------------
        # Default route to index.html
        if path == "/" or path == "/index":
            file_path = "public/index.html"
        elif path == "/admin":
            file_path = "public/admin.html"
        elif path.startswith("/uploads/"):
            # Serve prescription uploads
            file_path = path[1:] # strip leading slash
        else:
            file_path = "public" + path

        # Security check: Prevent directory traversal
        abs_base = os.path.abspath(".")
        abs_target = os.path.abspath(file_path)
        if not abs_target.startswith(abs_base):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"403 Forbidden: Directory Traversal Blocked")
            return

        # Check if file exists and serve
        if os.path.exists(file_path) and os.path.isfile(file_path):
            _, ext = os.path.splitext(file_path.lower())
            content_type = MIME_TYPES.get(ext, "application/octet-stream")
            
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f"500 Internal Server Error: {e}".encode("utf-8"))
        else:
            # File not found
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"404 Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Parse request body size
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ""

        # Parse request body as JSON
        body = {}
        if post_data:
            try:
                body = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_error_response("Invalid JSON structure", 400)
                return

        # ------------------ API ENDPOINTS ------------------
        if path == "/api/products":
            # Add Product (Admin only)
            if not self.verify_admin():
                return
            
            # Simple validation
            name = body.get("name")
            category = body.get("category")
            price = body.get("price")
            stock = body.get("stock")
            
            if not all([name, category, price is not None, stock is not None]):
                self.send_error_response("Missing required product fields", 400)
                return

            products = read_json_file(PRODUCTS_FILE, [])
            new_id = f"prod-{random.randint(100, 999)}-{len(products) + 1}"
            
            new_product = {
                "id": new_id,
                "name": str(name),
                "category": str(category),
                "price": float(price),
                "stock": int(stock),
                "description": str(body.get("description", "")),
                "dosage": str(body.get("dosage", "N/A")),
                "type": str(body.get("type", "Tablet")),
                "requiresPrescription": bool(body.get("requiresPrescription", False))
            }
            
            products.append(new_product)
            write_json_file(PRODUCTS_FILE, products)
            self.send_json_response(new_product, 201)

        elif path == "/api/orders":
            # Submit Purchase Request (Buyer)
            customer_name = body.get("customerName")
            phone = body.get("phone")
            address = body.get("address")
            items = body.get("items", []) # List of {productId, quantity}
            
            if not all([customer_name, phone, address, items]):
                self.send_error_response("Missing required checkout details", 400)
                return

            # Read inventory for validation
            products = read_json_file(PRODUCTS_FILE, [])
            prod_dict = {p["id"]: p for p in products}

            # Legal check for each product
            prescription_required = False
            validated_items = []
            total_price = 0.0

            for item in items:
                prod_id = item.get("productId")
                qty = int(item.get("quantity", 1))
                if prod_id not in prod_dict:
                    self.send_error_response(f"Product ID {prod_id} not found", 404)
                    return
                prod = prod_dict[prod_id]
                if not prod.get("isLegal", True):
                    self.send_error_response(f"Product {prod[\"name\"]} is not legal to sell", 400)
                    return
                if prod.get("requiresPrescription"):
                    prescription_required = True
                
                total_price += prod.get("price", 0) * qty
                validated_items.append({
                    "productId": prod_id,
                    "name": prod.get("name"),
                    "price": prod.get("price"),
                    "quantity": qty
                })

            # Check prescription validation and doctor verification
            prescription_base64 = body.get("prescriptionBase64")  # data URL string
            prescription_name = body.get("prescriptionName", "prescription.png")
            doctor_name = body.get("doctorName")
            doctor_license = body.get("doctorLicense")
            prescription_path = None

            if prescription_required:
                if not prescription_base64:
                    self.send_error_response("Prescription image is required for prescription medicines", 400)
                    return
                if not doctor_name or not doctor_license:
                    self.send_error_response("Doctor name and license are required for prescription medicines", 400)
                    return

            # Generate order tracking number: SW-RANDOM-E
            tracker_number = random.randint(1000, 9999)
            suffix = random.choice(["A", "B", "E", "X"])
            tracker_id = f"SW-{tracker_number}-{suffix}"

            # Save prescription if provided
            if prescription_base64:
                try:
                    # Parse DataURL e.g., data:image/png;base64,iVBORw0KGgo...
                    if "," in prescription_base64:
                        header, encoded_data = prescription_base64.split(",", 1)
                    else:
                        encoded_data = prescription_base64
                    
                    decoded_bytes = base64.b64decode(encoded_data)
                    
                    # Generate filename
                    _, file_ext = os.path.splitext(prescription_name)
                    if not file_ext:
                        file_ext = ".png"
                    
                    filename = f"prescription_{tracker_id}{file_ext}"
                    filepath = os.path.join(UPLOAD_DIR, filename)
                    
                    with open(filepath, "wb") as pf:
                        pf.write(decoded_bytes)
                    
                    prescription_path = f"/uploads/{filename}"
                except Exception as e:
                    print(f"Error parsing uploaded file: {e}")
                    self.send_error_response("Failed to process uploaded prescription file", 500)
                    return

            orders = read_json_file(ORDERS_FILE, [])
            new_order = {
                "id": f"order-{random.randint(1000, 9999)}-{len(orders) + 1}",
                "trackerId": tracker_id,
                "customerName": str(customer_name),
                "phone": str(phone),
                "address": str(address),
                "items": validated_items,
                "totalPrice": total_price,
                "prescriptionPath": prescription_path,
                "doctorName": body.get("doctorName"),
                "doctorLicense": body.get("doctorLicense"),            }

            # Deduct stock
            for item in validated_items:
                p_id = item["productId"]
                if p_id in prod_dict:
                    prod_dict[p_id]["stock"] = max(0, prod_dict[p_id]["stock"] - item["quantity"])
            
            write_json_file(PRODUCTS_FILE, list(prod_dict.values()))

            orders.append(new_order)
            write_json_file(ORDERS_FILE, orders)
            self.send_json_response(new_order, 201)

        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Parse request body size
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else ""

        body = {}
        if post_data:
            try:
                body = json.loads(post_data)
            except json.JSONDecodeError:
                self.send_error_response("Invalid JSON data", 400)
                return

        # ------------------ API ENDPOINTS ------------------
        if path.startswith("/api/products/"):
            # Update Product (Admin only)
            if not self.verify_admin():
                return

            # Extract ID: /api/products/prod-001 -> prod-001
            prod_id = path.replace("/api/products/", "")
            products = read_json_file(PRODUCTS_FILE, [])
            
            found = False
            for i, p in enumerate(products):
                if p["id"] == prod_id:
                    # Update fields
                    products[i]["name"] = body.get("name", p["name"])
                    products[i]["category"] = body.get("category", p["category"])
                    products[i]["price"] = float(body.get("price", p["price"]))
                    products[i]["stock"] = int(body.get("stock", p["stock"]))
                    products[i]["description"] = body.get("description", p["description"])
                    products[i]["dosage"] = body.get("dosage", p["dosage"])
                    products[i]["type"] = body.get("type", p["type"])
                    products[i]["requiresPrescription"] = bool(body.get("requiresPrescription", p["requiresPrescription"]))
                    
                    found = products[i]
                    break

            if found:
                write_json_file(PRODUCTS_FILE, products)
                self.send_json_response(found, 200)
            else:
                self.send_error_response("Product not found", 404)

        elif path.startswith("/api/orders/") and path.endswith("/status"):
            # Update Order Status (Admin only)
            if not self.verify_admin():
                return

            # Extract ID: /api/orders/order-123-1/status -> order-123-1
            order_id = path.replace("/api/orders/", "").replace("/status", "")
            new_status = body.get("status")

            if not new_status:
                self.send_error_response("Status field is required", 400)
                return

            orders = read_json_file(ORDERS_FILE, [])
            found = False
            
            for i, o in enumerate(orders):
                if o["id"] == order_id:
                    orders[i]["status"] = new_status
                    found = orders[i]
                    break

            if found:
                write_json_file(ORDERS_FILE, orders)
                self.send_json_response(found, 200)
            else:
                self.send_error_response("Order not found", 404)
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # ------------------ API ENDPOINTS ------------------
        if path.startswith("/api/products/"):
            # Delete Product (Admin only)
            if not self.verify_admin():
                return

            prod_id = path.replace("/api/products/", "")
            products = read_json_file(PRODUCTS_FILE, [])
            
            initial_len = len(products)
            products = [p for p in products if p["id"] != prod_id]
            
            if len(products) < initial_len:
                write_json_file(PRODUCTS_FILE, products)
                self.send_json_response({"success": True, "message": "Product deleted successfully"}, 200)
            else:
                self.send_error_response("Product not found", 404)
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    server_address = ("", PORT)
    httpd = HTTPServer(server_address, SwetaMedicalHandler)
    print(f"\n=======================================================")
    print(f"[STATUS] SWETA MEDICAL HALL - NATIVE BACKEND SERVER LAUNCHED")
    print(f"[URL] Server running at: http://localhost:{PORT}")
    print(f"[INFO] Seller Passcode: {ADMIN_PASSCODE}")
    print(f"[INFO] Local database initialized in '{DATA_DIR}/' folder")
    print(f"=======================================================\n")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()

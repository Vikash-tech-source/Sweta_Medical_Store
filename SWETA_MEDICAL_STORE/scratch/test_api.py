import urllib.request
import json
import base64
import time

URL_BASE = "http://localhost:8000"
PASSCODE = "SWETA2026"

def run_test():
    print("\n" + "="*50)
    print("  DYNAMIC API INTEGRATION TEST FOR SWETA MEDICAL HALL")
    print("="*50)

    try:
        # ------------------ TEST 1: GET PRODUCTS ------------------
        print("\n[TEST 1] Fetching store product inventory...")
        req = urllib.request.Request(f"{URL_BASE}/api/products")
        with urllib.request.urlopen(req) as res:
            products = json.loads(res.read().decode('utf-8'))
            print(f"  Success! Retrieved {len(products)} products from catalog.")
            assert len(products) > 0, "No products found!"
            
            # Save a few IDs for checkout test
            paracetamol = next(p for p in products if "Paracetamol" in p["name"])
            amoxicillin = next(p for p in products if "Amoxicillin" in p["name"])
            print(f"  - Resolved '{paracetamol['name']}' (ID: {paracetamol['id']}, Stock: {paracetamol['stock']})")
            print(f"  - Resolved '{amoxicillin['name']}' (ID: {amoxicillin['id']}, Stock: {amoxicillin['stock']}, Rx Required: {amoxicillin['requiresPrescription']})")

        # ------------------ TEST 2: POST PLACE ORDER (WITH RX) ------------------
        print("\n[TEST 2] Submitting purchase request order (gated with prescription)...")
        # Base64 for a 1x1 green PNG pixel
        dummy_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkQPjfDwACgwF3PZ167QAAAABJRU5ErkJggg=="
        
        payload = {
            "customerName": "Alok Kumar Tester",
            "phone": "+91 94310 99999",
            "address": "Siwan Bypass Road, Siwan, Bihar - 843599",
            "items": [
                {"productId": paracetamol["id"], "quantity": 2},
                {"productId": amoxicillin["id"], "quantity": 1}
            ],
            "prescriptionBase64": dummy_base64,
            "prescriptionName": "alok_prescription_test.png"
        }

        data_bytes = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            f"{URL_BASE}/api/orders",
            data=data_bytes,
            headers={"Content-Type": "application/json"}
        )
        
        tracker_id = None
        order_id = None
        with urllib.request.urlopen(req) as res:
            order_res = json.loads(res.read().decode('utf-8'))
            tracker_id = order_res.get("trackerId")
            order_id = order_res.get("id")
            print(f"  Success! Created Order Request Ticket.")
            print(f"  - Assigned Order ID: {order_id}")
            print(f"  - Assigned Track ID: {tracker_id}")
            print(f"  - Total Price: INR {order_res['totalPrice']}")
            print(f"  - Uploaded Prescription saved at: {order_res['prescriptionPath']}")
            
            assert tracker_id is not None, "Failed to get trackerId!"
            assert order_res["status"] == "Pending", "Order status should initially be 'Pending'!"

        # ------------------ TEST 3: GET ORDER VIA TRACKER (NO PASSCODE) ------------------
        print("\n[TEST 3] Tracking order status via public Track ID...")
        req = urllib.request.Request(f"{URL_BASE}/api/orders?trackerId={tracker_id}")
        with urllib.request.urlopen(req) as res:
            tracking_res = json.loads(res.read().decode('utf-8'))
            print(f"  Success! Located ticket details via public query.")
            print(f"  - Customer Name: {tracking_res['customerName']}")
            print(f"  - Timeline Phase: {tracking_res['status']}")
            assert tracking_res["id"] == order_id, "Order IDs do not match!"

        # ------------------ TEST 4: UPDATE ORDER STATUS (ADMIN AUTH GATED) ------------------
        print("\n[TEST 4] Updating order status workflow as seller (passcode auth)...")
        # First test: Try to update without passcode or incorrect passcode (should fail with 401)
        try:
            req = urllib.request.Request(
                f"{URL_BASE}/api/orders/{order_id}/status",
                data=json.dumps({"status": "Approved"}).encode('utf-8'),
                headers={"Content-Type": "application/json", "X-Admin-Passcode": "WRONG_KEY"},
                method="PUT"
            )
            with urllib.request.urlopen(req) as res:
                pass
            print("  Fail! Was able to update status with a bad passcode.")
            return False
        except urllib.error.HTTPError as e:
            if e.code == 401:
                print("  Success! Server correctly blocked unauthorized request with a 401 status.")
            else:
                print(f"  Fail! Got unexpected error code: {e.code}")
                return False

        # Second test: Update with correct passcode (should succeed)
        req = urllib.request.Request(
            f"{URL_BASE}/api/orders/{order_id}/status",
            data=json.dumps({"status": "Approved"}).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "X-Admin-Passcode": PASSCODE
            },
            method="PUT"
        )
        with urllib.request.urlopen(req) as res:
            update_res = json.loads(res.read().decode('utf-8'))
            print("  Success! Server approved status advancement with correct passcode.")
            print(f"  - New Status updated to: {update_res['status']}")
            assert update_res["status"] == "Approved", "Status update was not saved!"

        # ------------------ TEST 5: RE-TRACK STATUS ------------------
        print("\n[TEST 5] Re-tracking order status to verify update timeline...")
        req = urllib.request.Request(f"{URL_BASE}/api/orders?trackerId={tracker_id}")
        with urllib.request.urlopen(req) as res:
            retrack_res = json.loads(res.read().decode('utf-8'))
            print("  Success! Confirmed order status moved forward.")
            print(f"  - Live order timeline status: {retrack_res['status']}")
            assert retrack_res["status"] == "Approved", "Retracked status does not match!"

        print("\n" + "="*50)
        print("  ALL DYNAMIC API TESTS COMPLETED SUCCESSFULLY!")
        print("  - Backend and database pipelines are 100% operational.")
        print("="*50 + "\n")
        return True

    except Exception as err:
        print(f"\n  CRITICAL INTEGRATION TEST FAILED: {err}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    run_test()

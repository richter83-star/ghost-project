import os
import random
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

def initialize_firebase():
    """
    Initializes the Firebase Admin SDK.
    It looks for the service account key in a file path
    specified by the 'FIREBASE_SERVICE_ACCOUNT_PATH' environment variable,
    or a secret file named 'oracle_service_account.json'.
    """
    # Render's "Secret File" will be at a specific path
    secret_file_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_PATH', 'oracle_service_account.json')

    if not os.path.exists(secret_file_path):
        print(f"Error: Service account key file not found at {secret_file_path}")
        print("Please add this file as a 'Secret File' in your Render service settings.")
        return None

    try:
        cred = credentials.Certificate(secret_file_path)
        firebase_admin.initialize_app(cred)
        print("Firebase Admin initialized successfully.")
        return firestore.client()
    except Exception as e:
        print(f"Error initializing Firebase: {e}")
        return None

def generate_product_job(db, jobs_collection_name):
    """
    Generates a sample product and writes it to Firestore
    with 'status: pending'.
    """
    if db is None:
        print("Firestore client is not initialized. Exiting.")
        return

    # Sample data to create a product job
    sample_products = [
        {
            "title": "Quantum T-Shirt",
            "description": "A stylish t-shirt that's both here and there.",
            "productType": "Apparel",
            "price": 29.99,
            "imageUrl": "https://placehold.co/600x600/9333ea/white?text=Quantum+Tee"
        },
        {
            "title": "NeuralSip Coffee Mug",
            "description": "Start your day with an AI-powered brew.",
            "productType": "Homeware",
            "price": 18.50,
            "imageUrl": "https://placehold.co/600x600/f59e0b/white?text=NeuralSip+Mug"
        },
        {
            "title": "Cybernetic Bonsai",
            "description": "A mix of ancient tradition and future tech. Needs no watering.",
            "productType": "Decor",
            "price": 89.99,
            "imageUrl": "https://placehold.co/600x600/10b981/white?text=Cyber+Bonsai"
        },
        {
            "title": "Ghost-Project Hoodie",
            "description": "The perfect hoodie for autonomous developers.",
            "productType": "Apparel",
            "price": 65.00,
            "imageUrl": "https://placehold.co/600x600/3b82f6/white?text=Ghost+Hoodie"
        }
    ]

    # Pick a random product to create a job for
    product_data = random.choice(sample_products)
    
    # Add the job-specific fields
    product_data['status'] = 'pending'
    product_data['createdAt'] = datetime.utcnow()

    try:
        # Add a new document with an auto-generated ID
        doc_ref = db.collection(jobs_collection_name).add(product_data)
        print(f"Successfully created product job with ID: {doc_ref[1].id}")
        print(f"Product: {product_data['title']}")
    except Exception as e:
        print(f"Error creating Firestore job: {e}")

def main():
    """
    Main function to run the Oracle job.
    """
    print(f"Oracle 'brain.py' started at {datetime.utcnow().isoformat()}Z")
    
    # Get the collection name from environment variables, default to 'products'
    jobs_collection_name = os.environ.get('FIRESTORE_JOBS_COLLECTION', 'products')
    
    db = initialize_firebase()
    generate_product_job(db, jobs_collection_name)
    
    print(f"Oracle 'brain.py' finished at {datetime.utcnow().isoformat()}Z")

if __name__ == "__main__":
    main()
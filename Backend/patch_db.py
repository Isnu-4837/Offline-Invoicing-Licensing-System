import sqlite3
import os

# Connect to the local SQLite database file
db_path = os.path.join(os.path.dirname(__file__), 'app.db')
print(f"Connecting to database at: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Fix poisoned "QUOTATION" payment statuses 
    cursor.execute("UPDATE invoices SET payment_status = 'DUE' WHERE payment_status LIKE '%QUOTATION%'")
    
    # 2. Clean up doc_type formatting (e.g. DocTypeEnum.QUOTATION -> QUOTATION)
    cursor.execute("UPDATE invoices SET doc_type = 'QUOTATION' WHERE doc_type LIKE '%QUOTATION%'")
    cursor.execute("UPDATE invoices SET doc_type = 'INVOICE' WHERE doc_type LIKE '%INVOICE%'")
    
    # 3. Clean up payment_status formatting
    cursor.execute("UPDATE invoices SET payment_status = 'PAID' WHERE payment_status LIKE '%PAID%'")
    cursor.execute("UPDATE invoices SET payment_status = 'DUE' WHERE payment_status LIKE '%DUE%'")
    cursor.execute("UPDATE invoices SET payment_status = 'PARTIAL' WHERE payment_status LIKE '%PARTIAL%'")
    cursor.execute("UPDATE invoices SET payment_status = 'INSTALLMENT' WHERE payment_status LIKE '%INSTALLMENT%'")

    # 4. Nullify empty dates which cause 500 Pydantic validation crashes
    cursor.execute("UPDATE invoices SET due_date = NULL WHERE due_date = ''")
    cursor.execute("UPDATE invoices SET emi_start_date = NULL WHERE emi_start_date = ''")
    
    conn.commit()
    print("SUCCESS: Database patched and poisoned data neutralized!")
    
except Exception as e:
    print(f"FAILED to patch database: {e}")
finally:
    if 'conn' in locals():
        conn.close()
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

# Email Configuration
conf = ConnectionConfig(
    MAIL_USERNAME="rahulverma9548961117@gmail.com",
    MAIL_PASSWORD="svjliqdencxmgvzf",
    MAIL_FROM="CRM SUPPORT <rahulverma9548961117@gmail.com>",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True, 
    MAIL_SSL_TLS=False,    
    USE_CREDENTIALS=True,  
    VALIDATE_CERTS=True,  
)
async def send_order_confirmation_email(email: str, order: dict):

    message = MessageSchema(

        subject="Order Confirmation Mail - CRM Support",
        recipients=[email],
        body = f"""
Dear {order.get('customer_name')},

Thank you for placing an order with us!

We are pleased to confirm that your order has been received and is being processed.

Order Summary:
--------------
Order ID: {order.get('order_id')} | Item: {order.get('item_name')} | Quantity: {order.get('quantity')} | Unit Price: ₹{order.get('price')} | Total: ₹{order.get('total_amount')} | Status: {order.get('status').capitalize()}

We will notify you when your order is shipped. Meanwhile, you can track your order status on our website using your Order ID.

If you have any questions or need assistance, please feel free to contact our customer support team at support@example.com or call us at +1-234-567-8900.

Thank you for choosing us. We appreciate your business!

Best regards,
CRM Support Team

---
CRM Company Name
123 Business Road
City, State, Zip
Phone: +1-234-567-8900
Email: support@example.com
Website: www.crmcompany.com
""",
subtype='plain'
)
    fm = FastMail(conf)
    await fm.send_message(message)

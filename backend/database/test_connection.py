from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
    print("✅ Connected! Tables found:")
    for row in result:
        print(" -", row[0])
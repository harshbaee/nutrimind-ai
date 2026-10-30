-- Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    calorie_goal INTEGER DEFAULT 2000,
    protein_goal INTEGER DEFAULT 150,
    budget_weekly NUMERIC(6,2) DEFAULT 50.00,
    dietary_preference VARCHAR(50) DEFAULT 'none',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products (from OpenFoodFacts or manual entry)
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(50) UNIQUE,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    calories_per_100g NUMERIC(6,2),
    protein_per_100g NUMERIC(6,2),
    carbs_per_100g NUMERIC(6,2),
    fat_per_100g NUMERIC(6,2),
    serving_size_g NUMERIC(6,2),
    estimated_price_eur NUMERIC(6,2),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Meals
CREATE TABLE IF NOT EXISTS meals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    meal_type VARCHAR(50),  -- breakfast, lunch, dinner, snack
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_calories NUMERIC(7,2),
    total_protein NUMERIC(6,2),
    total_carbs NUMERIC(6,2),
    total_fat NUMERIC(6,2),
    total_cost_eur NUMERIC(6,2)
);

-- Food logs (individual items inside a meal)
CREATE TABLE IF NOT EXISTS food_logs (
    id SERIAL PRIMARY KEY,
    meal_id INTEGER REFERENCES meals(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity_g NUMERIC(6,2) NOT NULL,
    calories NUMERIC(7,2),
    protein NUMERIC(6,2),
    carbs NUMERIC(6,2),
    fat NUMERIC(6,2),
    cost_eur NUMERIC(6,2)
);

-- Spending history (daily summaries)
CREATE TABLE IF NOT EXISTS spending_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_spent_eur NUMERIC(6,2),
    total_calories INTEGER,
    total_protein NUMERIC(6,2),
    meal_count INTEGER,
    UNIQUE(user_id, date)
);

-- Recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100),  -- substitution, meal_plan, behavioural
    message TEXT,
    source_product_id INTEGER REFERENCES products(id),
    suggested_product_id INTEGER REFERENCES products(id),
    savings_eur NUMERIC(6,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
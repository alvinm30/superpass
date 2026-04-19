# Superpass

A private daily quiz and collaborative study web application for a small group of 5 students (Alvin, Avis, Martin, Kelly, and Vinci).

## Project Setup & Deployment

This project consists of pure HTML, CSS, and Vanilla JavaScript. It uses Supabase for backend storage.

### 1. Supabase Database Configuration

Since this application is fully statically hosted and uses the "anon key", it is CRITICAL to enforce correct Row Level Security (RLS) policies on your Supabase tables.

#### Create Tables

Run the following SQL in the Supabase SQL Editor:

```sql
-- Create Questions Table
CREATE TABLE public.questions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date DATE NOT NULL,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    reference TEXT,
    is_revealed BOOLEAN DEFAULT FALSE
);

-- Create Answers Table
CREATE TABLE public.answers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE,
    student TEXT NOT NULL,
    answer_text TEXT NOT NULL
);
```

#### Row Level Security (RLS) Policies

For a truly secure app, you would normally use Supabase Auth to confirm a user's identity. Because this app relies on a simple password-less cookie "login" method on the client side, the database literally cannot tell who the user is from an Auth perspective (they are all anonymous).

However, you *can* basic policies if necessary, but because the anon key is public and there's no real backend JWT verification for these 5 specific users, anyone with the network traffic can technically read/write if they know the schema.

To restrict at least accidental damage, set these:

```sql
-- Enable RLS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to all questions
CREATE POLICY "Allow anon read questions" ON public.questions
    FOR SELECT TO anon USING (true);

-- Allow anonymous insert to questions
CREATE POLICY "Allow anon insert questions" ON public.questions
    FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous update to questions (for revealing answers and edits)
CREATE POLICY "Allow anon update questions" ON public.questions
    FOR UPDATE TO anon USING (true);


-- Allow anonymous read access to answers (Logic in app.js prevents showing them until revealed, but DB level is open without Auth)
CREATE POLICY "Allow anon read answers" ON public.answers
    FOR SELECT TO anon USING (true);

-- Allow anonymous insert answers
CREATE POLICY "Allow anon insert answers" ON public.answers
    FOR INSERT TO anon WITH CHECK (true);

-- Allow anonymous update to answers
CREATE POLICY "Allow anon update answers" ON public.answers
    FOR UPDATE TO anon USING (true);
```

*(Note: For strict production environments, implementing Supabase Auth email/magic link login is highly recommended to properly secure the `answers` table so users cannot read each other's answers via direct API calls before they are revealed.)*

### 2. Local Development

1. Open `index.html` in your browser.
2. The app will connect strictly to the Supabase provided URL.
3. Everything works directly in the browser—no build step required!

### 3. Deploying to GitHub Pages

1. **Initialize a Git repository:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit Superpass"
   ```
2. **Push to GitHub:**
   - Create a new repository on your GitHub account (named `superpass`).
   - Push your local code to this new repo:
     ```bash
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/superpass.git
     git push -u origin main
     ```
3. **Enable GitHub Pages:**
   - Navigate to your repository on GitHub.
   - Go to **Settings** > **Pages**.
   - Under **Source**, select the `main` branch and the `/ (root)` folder.
   - Click **Save**.
   - Your site will be published at `https://YOUR_USERNAME.github.io/superpass/` in a few minutes!

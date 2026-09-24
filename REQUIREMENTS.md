# Problem Specifications

## Project Overview

PantryCart is an intelligent cooking application designed to aid users in discovering recipes, track meals, and achieve dietary goals with AI suggestions. PantryCart can analyze ingredients users have at home and generate recipe ideas or provide small shopping lists to create new delicious dishes. Users can also browse a wide selection of recipes, with the ability to filter by cuisine type and then export the calorie and macronutrient information to third party fitness or health applications. Developed as a semester-long capstone project, PantryCart aims to simplify meal planning, promote healthy habits, while making cooking more enjoyable and convenient.

## Project Description

PantryCart was created to address challenges people face when deciding what to cook. Many people struggle with meal inspiration and hitting their dietary goals. PantryCart provides a smart, adaptive solution through AI-driven recommendations and meal suggestions. Users can input a list of ingredients and the system will suggest meals that can be made with on hand items or meals that can be made by purchasing a few additional items from the store. The app allows users to browse by recipe category such as cuisine types (Example: Mexican, Italian, Indian) or by specific dietary needs, food allergies, or calorie amount. Each recipe includes detailed nutritional information which can be exported to third party health applications.

The system will be developed using a Next.js Stack with data stored remotely in supabase. Recipe and nutritional data will be fetched via free or low-cost APIs. The application will feature user account management, recipe ratings, favoriting of recipes, and a clean and easy to use interface. The project will be developed by me solo over a school semester using free or low-cost hosting such as Vercel. Its success will be measured by system responsiveness, reliability and accuracy of recipe generations.

## 1. Project Overview

An ai powered smart cooking app designed to help users discover recipes, track meals and help manage their dietary goals. Recipes will be pulled from an api, as well as generated via the use of ai to generate a recipe with ingredients users have on hand, or generate a small shopping list to make other recipes using on hand items. Users can also freely browse recipes from an api as well as export calorie and macros to other calorie-tracking apps.

## 2. Stakeholder Identification

- **Users** - Users will be able to use the PantryCart to generate recipes using ai, create recipes for others to view, track nutrition and manage recipes.
- **Administrators** - Will be responsible for managing users and recipes.
- **Developers** - Responsible for maintaining and building the app.

## 3. Functional Requirements

### 3.1 User Management

- 3.1.1: Users can register and log in securely
- 3.1.2: Users can manage their profiles. Identity is split into a permanent, unique username (set once at signup, never editable - avoids other users being confused by a renamed identity, or someone else claiming a freed-up handle) and a freely-editable display_name (cosmetic, not unique) plus email (also editable).

### 3.2 User Functionality

- 3.2.1: Users can favor recipes, view previous recipes
- 3.2.2: Users can create recipes
- 3.2.3: Users can rate recipes
- 3.2.4: Users can comment on a recipe
- 3.2.5: Users can give a list of ingredients and get a generated response of what they can make or optionally can view recipes containing items they have with a small shopping list to make other recipes.
- 3.2.6: Users can browse recipes by categories, recipe name, cuisine type (Mexican,Thai, Italian,Etc), filter by allergies, or ingredients.
- 3.2.7: Users can view step by step instructions on how to prepare a recipe

### 3.3 Nutritional Tracking

- 3.3.1: The app will display calories of each recipe
- 3.3.2: The app will be able to filter recipes by nutritional info.

### 3.4 Administrators

- 3.4.1: Admins will be able to delete user accounts.
- 3.4.2: Admins will be able to delete inappropriate or inaccurate recipes.
- 3.4.3: Admins will be able to remove user comments
- 3.4.4: Admin status is tracked via a separate admins table (referencing a user's id) rather than a flag on the users table, so no application code path can ever grant admin access to an account - it can only be granted manually via direct database access.

## 4. Non-Functional Requirements

- **Performance** - Standard requests (browsing, filtering, auth) must receive responses in under 2 seconds. AI-generated content (recipe generation, shopping lists) is exempt from this target and should instead complete in under 15 seconds with a loading indicator shown to the user.
- **Scalability** - Should support at least 1000 registered users. Since recipe/nutrition data comes from a free-tier third-party API with a limited daily request quota, API responses should be cached so actual call volume stays well under that limit regardless of registered user count.
- **Usability** - The app should have a easy to use interface
- **Consistency** - Shared UI elements that appear on multiple pages (e.g. the top header bar on authenticated pages) must be implemented as a single shared component, never copy-pasted per page. Per-page copies drift out of alignment over time as one gets edited and the other doesn't; a shared component makes drift structurally impossible.
- **Security** - User data should be encrypted and stored securely.
- **Availability** - Should maintain a high uptime

## 5. Use Cases / User Stories

- As a person looking to keep a healthy lifestyle I want an app that helps me find new recipes with what I have on hand so that I can maintain my fitness goals.
- As a person who is getting into cooking I want an app that helps me find new and creative ideas to cook each night while also having a way to store recipes I love.
- As a user with allergies, I want to filter out recipes containing peanuts so I can cook safely.
- As a busy student, I want to generate a shopping list for 3 days of meals so I can shop quickly and prepare meals easily.

## 6. Constraints

List limitations such as time, budget, resources, technology stack, or regulations.

- **Time**: Must be completed within one school semester (5 months)
- **Budget**: limited to free or low cost api and hosting
- **Resources**: Solo development team
- **Technology stack**: Next.js
- **Stretch goals**: Third-party fitness/health app export (calorie/macro sync) has no dedicated time in the 14-week schedule below. It stays in scope as an aspirational feature but is the first thing to cut if any earlier benchmark runs long.

## 7. Data Requirements

Describe the data inputs, outputs, storage, and processing needs.

**Inputs:**

- The system must store a permanent username, an editable display name, an editable email, passwords, and favorite recipes, and create recipes in a secure database.
- Takes user input for a list of on hand items
- User-submitted recipe ratings and comments.

**Outputs:**

- The system must be able to output a list of recipes and be able to filter the output to search for specific types of recipes, and must also be able to retrieve favorite recipes.
- Nutritional information of a recipe that is able to be exported.
- Custom shopping lists for generated recipes based on user inputs.
- Favorite recipes.

**Storage:**

- Stores profile data, favorite recipes, recipe list, user-created recipes, recipe ratings, and recipe comments.
- A separate admins table tracks which user ids have admin privileges (see 3.4.4).

**Processing:**

- Api calls to fetch nutritional and recipe data.
- Shopping list and recipe generation logic.

## Solution Process and Design

### Use Case Diagram (UCD)

The use case diagram demonstrates the two main actors (users and admins) functionality within the core of the app. The primary actor the user has most of the apps functionality for example: account management, recipe browsing, recipe generation, shopping list generation, and the ability to create and interact with recipes. The admin has small amounts of things to do for management of the app such as deleting accounts, comments, or recipes.

### System Context Diagram (SCD)

The System Context Diagram provides a very high level overview of how PantryCart interacts with the actors and external API's. The SCD also shows how data will flow between these parts.

## Benchmark Specification

### Benchmark 1 - User Management

- [x] Create a simple landing page
- [x] Backend routes for user authentication (register/login/logout, session tokens)
- [x] Create login/signup pages
- [x] Connect authentication routes to the frontend so login/signup is possible from the UI
- [x] Create FE for account page (view permanent username, edit display name and email, logout)
- [ ] Create BE routes for uploading profile images (via Supabase Storage)
- [ ] Create admin functionality for app management

### Benchmark 2 - Recipe search implementation, creation, and interaction

- [ ] Connect external api to backend routes, make api routes for fetching recipes and filtering them.
- [ ] Make Routes for favoriting recipes, rating a recipe, and commenting on a recipe.
- [ ] Make routes for user made recipes.

### Benchmark 3 - Recipe and shopping list generation

- [ ] Create AI based recipe generator
- [ ] Create routes for making a shopping list based on missing ingredients from the AI Recipe Generator.

## Proposed Tools for Implementation

- **Programming Languages**: JavaScript / TypeScript
- **Frameworks**: Next.js, React, Tailwind, Axios
- **Database**: PostgreSQL (Supabase)
- **Storage**: Supabase Storage (S3-compatible, no separate cloud vendor/credentials to manage)
- **Project Management Tool**: Github board
- **Source Control Tool**: GitHub
- **API**: Spoonacular - https://spoonacular.com/food-api

## Weekly Schedule

### Week 1 - Initial Project Setup

- [x] Setup github repo
- [x] Setup hosting of frontend and backend
- [x] Create a simple landing page

### Week 2 - User Authentication

- [x] Backend routes for user authentication (register/login/logout, session tokens)
- [x] Create login/signup pages
- [x] Connect authentication routes to the frontend so login/signup is possible

### Week 3 - User Profiles

- [x] Create FE for account page (view permanent username, edit display name and email, logout)
- [ ] Create BE routes for uploading profile images (via Supabase Storage)

### Week 4 & 5 - Recipe Browsing + Filtering

- [ ] Connect external api to backend routes, make api routes for fetching recipes and filtering them.

### Week 6 - Favorites, Ratings, and Comments

- [ ] Make Routes for favoriting recipes, rating a recipe, and commenting on a recipe.

### Week 7 - User Created Recipes

- [ ] Make routes for user made recipes.

### Week 8 & 9 - AI Recipe Generator

- [ ] Create AI based recipe generator

### Week 10 & 11 - AI Shopping List

- [ ] Create routes for making a shopping list based on missing ingredients from the AI Recipe Generator.

### Week 12 - Admin Functionality

- [ ] Make admin routes for app management.

### Week 13 - Testing and Debugging

- [ ] Extra spare time for polishing of routes or adding additional functionality if time permits.

### Week 14 - Final Deployment

- [ ] Ensure that the app functions properly under load and fix any errors.

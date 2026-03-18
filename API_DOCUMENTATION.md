# 📚 Pliz Platform API Documentation

**Version:** 1.0.0  
**Base URL:** `https://api.pliz.app` (Production) | `http://localhost:3000` (Development)  
**Last Updated:** March 12, 2026

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [API Endpoints](#api-endpoints)
   - [Auth](#auth-endpoints)
   - [User Profile](#user-profile-endpoints)
   - [Sessions](#session-management-endpoints)
   - [Categories](#category-endpoints)
   - [Begs](#beg-endpoints)
   - [Donations](#donation-endpoints)
   - [Withdrawals](#withdrawal-endpoints)
   - [Notifications](#notification-endpoints)
6. [WebSocket Events](#websocket-events)
7. [Data Models](#data-models)

---

## Overview

Pliz is a begging platform that connects people in need with donors. The API follows REST principles and returns JSON responses.

### Key Features
- 🔐 JWT-based authentication with refresh tokens
- 👤 Multi-session management
- 🎯 Trust tier system
- 💰 Paystack payment integration
- 📨 Real-time notifications (Socket.io)
- 💳 Nigerian bank account management

### Base Response Format

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message here",
  "errors": [
    {
      "field": "email",
      "message": "Email is required"
    }
  ]
}
```

---

## Authentication

The API uses **JWT (JSON Web Tokens)** for authentication with a dual-token system:
- **Access Token:** Short-lived (15 minutes), sent with each request
- **Refresh Token:** Long-lived (7 days), used to get new access tokens

### Headers Required

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

### Token Storage

**Recommended approach:**
- Store `accessToken` in memory (React state/context)
- Store `refreshToken` in `httpOnly` cookie (handled by backend)
- **Never** store tokens in localStorage (XSS vulnerability)

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in or token expired) |
| 403 | Forbidden (account suspended/under investigation) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Auth (login, register) | 5 requests | 15 minutes |
| General API | 100 requests | 15 minutes |
| Password reset | 3 requests | 1 hour |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1678886400
```

---

## API Endpoints

## Auth Endpoints

### Signup

Create a new user account.

**Endpoint:** `POST /api/auth/signup`  
**Auth Required:** No

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Validation Rules:**
- Username: 3-30 characters, alphanumeric + underscore
- Email: Valid email format
- Password: Min 8 characters, 1 uppercase, 1 lowercase, 1 number
- Passwords must match

**Success Response:** `201 Created`
```json
{
  "success": true,
  "message": "Registration successful!",
  "data": {
    "user": {
      "id": "uuid",
      "username": "johndoe",
      "email": "john@example.com",
      "isEmailVerified": false
    }
  }
}
```

---

### Login

Authenticate and receive access/refresh tokens.

**Endpoint:** `POST /api/auth/login`  
**Auth Required:** No

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",
    "session": {
      "id": "session-uuid",
      "expiresAt": "2026-03-19T10:30:00Z"
    }
  }
}
```

---

## User Profile Endpoints

### Complete Profile

Complete user profile (required for creating begs).

**Endpoint:** `POST /api/profile/complete`  
**Auth Required:** Yes

**Request Body:**
```json
{
  "firstName": "John",
  "middleName": "Michael",
  "lastName": "Doe",
  "phoneNumber": "+2348012345678",
  "displayName": "JohnD",
  "isAnonymous": false,
  "agreeToTerms": true
}
```

**Validation Rules:**
- First name: Required, max 100 characters
- Phone number: Required, valid format
- Agree to terms: Required, must be `true`

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Profile completed successfully!",
  "data": {
    "profile": { ... }
  }
}
```

---

## Beg Endpoints

### Create Beg

Create a new beg request.

**Endpoint:** `POST /api/begs`  
**Auth Required:** Yes  
**Profile Complete Required:** Yes

**Request Body:**
```json
{
  "category": "food",
  "title": "Help with groceries",
  "description": "Need urgent help",
  "amountRequested": 5000
}
```

**Validation Rules:**
- Title: 1-25 characters (required)
- Description: Max 500 characters / 30 words (optional)
- Amount: Min ₦100, max based on trust tier

**Success Response:** `201 Created`

---

### Get Active Begs (Feed)

Browse active, approved begs.

**Endpoint:** `GET /api/begs`  
**Auth Required:** No

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 50)
- `category` - Filter by category ID (optional)

**Success Response:** `200 OK`

---

## Donation Endpoints

### Initialize Donation

Initialize a donation (creates Paystack payment).

**Endpoint:** `POST /api/donations/initialize`  
**Auth Required:** Yes

**Request Body:**
```json
{
  "begId": "beg-uuid",
  "amount": 1000,
  "isAnonymous": false,
  "message": "Hope this helps!"
}
```

**Success Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://checkout.paystack.com/xyz123",
    "reference": "pliz_1234567890",
    "amount": 1000
  }
}
```

---

## Withdrawal Endpoints

### Bank Account Management

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/withdrawals/banks` | GET | No | Get Nigerian banks |
| `/api/withdrawals/bank-accounts` | POST | Yes | Add bank account |
| `/api/withdrawals/bank-accounts` | GET | Yes | Get user's accounts |
| `/api/withdrawals/bank-accounts/:id` | PUT | Yes | Set as default |
| `/api/withdrawals/bank-accounts/:id` | DELETE | Yes | Delete account |
| `/api/withdrawals/request` | POST | Yes | Request withdrawal |

### Add Bank Account

**Endpoint:** `POST /api/withdrawals/bank-accounts`

**Request Body:**
```json
{
  "accountNumber": "1234567890",
  "bankCode": "058"
}
```

---

## Notification Endpoints

### Get Notifications

Get user's notifications.

**Endpoint:** `GET /api/notifications`  
**Auth Required:** Yes

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "total": 15,
    "page": 1,
    "pages": 1,
    "unreadCount": 3
  }
}
```

### Mark as Read

**Endpoint:** `PUT /api/notifications/:id/read`

### Mark All as Read

**Endpoint:** `PUT /api/notifications/mark-all-read`

### Delete Notification

**Endpoint:** `DELETE /api/notifications/:id`

### Notification Types

| Type | Description |
|------|-------------|
| `donation_received` | Someone donated to your beg |
| `beg_approved` | Admin approved your beg |
| `beg_rejected` | Admin rejected your beg |
| `gratitude_received` | You received thank you message |
| `beg_funded` | Your beg reached its goal |
| `beg_expiring` | Your beg expires soon |

---

## Admin Endpoints

**Note:** All admin endpoints require authentication + Admin or SuperAdmin role.

### User Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | Get all users with filters |
| `/api/admin/users/:id/suspend` | POST | Suspend user account |
| `/api/admin/users/:id/unsuspend` | POST | Unsuspend user account |
| `/api/admin/users/:id/investigate` | POST | Mark account under investigation |
| `/api/admin/users/:id/close-investigation` | POST | Close investigation on account |

#### Get All Users

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `search` - Search username/email (optional)
- `status` - Filter by status: `active`, `suspended`, `investigated`

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "users": [...],
    "total": 1250,
    "page": 1,
    "pages": 63
  }
}
```

### Beg Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/begs` | GET | Get all begs with filters |
| `/api/admin/begs/:id/approve` | PATCH | Approve pending beg |
| `/api/admin/begs/:id/reject` | PATCH | Reject beg with reason |
| `/api/admin/begs/:id` | DELETE | Delete a beg |

#### Approve Beg

**Endpoint:** `PATCH /api/admin/begs/:id/approve`

**Success Response:** `200 OK`
```json
{
  "success": true,
  "message": "Beg approved successfully"
}
```

#### Reject Beg

**Endpoint:** `PATCH /api/admin/begs/:id/reject`

**Request Body:**
```json
{
  "reason": "Does not meet community guidelines"
}
```

### Category Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/categories` | GET | Get all categories |
| `/api/admin/categories` | POST | Create new category |
| `/api/admin/categories/:id` | PATCH | Update category |
| `/api/admin/categories/:id` | DELETE | Delete category |

#### Create Category

**Endpoint:** `POST /api/admin/categories`

**Request Body:**
```json
{
  "name": "Medical",
  "slug": "medical",
  "description": "Medical bills and health expenses",
  "icon": "🏥",
  "sortOrder": 1
}
```

### Withdrawal Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/withdrawals` | GET | Get all withdrawals |
| `/api/admin/withdrawals/:id/process` | POST | Process/approve withdrawal |
| `/api/admin/withdrawals/:id/reject` | POST | Reject withdrawal with reason |

### Analytics & Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/dashboard/stats` | GET | Get dashboard statistics |

**Success Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "totalUsers": 1250,
    "totalBegs": 450,
    "pendingBegs": 23,
    "totalDonations": 15000,
    "totalWithdrawals": 89
  }
}
```

### Activity Logs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/activity` | GET | Get admin activity logs |

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `adminId` - Filter by admin user ID (optional)
- `action` - Filter by action type (optional)

---

## WebSocket Events

Connect to Socket.io for real-time notifications.

**Connection:**
```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.pliz.app', {
  auth: { token: accessToken }
});
```

### Event: `notification`

Receive real-time notifications.

**Payload:**
```json
{
  "id": "uuid",
  "type": "donation_received",
  "title": "New Donation!",
  "message": "You received ₦1,000",
  "createdAt": "2026-03-12T10:00:00Z"
}
```

**Notification Types:**
- `donation_received` - Someone donated to your beg
- `beg_approved` - Your beg was approved by admin
- `beg_rejected` - Your beg was rejected
- `gratitude_received` - You received a thank you message
- `beg_funded` - Your beg reached its goal
- `beg_expiring` - Your beg expires soon

---

## Data Models

### User
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  isSuspended: boolean;
}
```

### Profile
```typescript
interface Profile {
  firstName: string;
  middleName: string | null;
  lastName: string;
  phoneNumber: string;
  displayName: string | null;
  isAnonymous: boolean;
  agreeToTerms: boolean;
}
```

### Beg
```typescript
interface Beg {
  id: string;
  title: string;
  description: string | null;
  amountRequested: number;
  amountRaised: number;
  status: 'active' | 'funded' | 'expired' | 'cancelled';
  approved: boolean;
  expiresAt: Date;
}
```

---

## Support

**API Issues:** backend@pliz.app  
**Documentation:** docs@pliz.app

---

**Last Updated:** March 12, 2026  
**API Version:** 1.0.0

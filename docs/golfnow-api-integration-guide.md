# GolfNow Affiliate API Integration Guide

> **Comprehensive guide for integrating with GolfNow's Affiliate & Partner API**

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Authentication](#authentication)
4. [Core API Endpoints](#core-api-endpoints)
5. [Tee Time Search](#tee-time-search)
6. [Creating Bookings](#creating-bookings)
7. [Affiliate Payments & Commission Tracking](#affiliate-payments--commission-tracking)
8. [Rate Limits & Best Practices](#rate-limits--best-practices)
9. [SDK & Libraries](#sdk--libraries)
10. [Code Examples](#code-examples)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The GolfNow API is a reservation and booking service that enables partners and affiliates to:
- Search for golf courses and facilities
- Find available tee times
- Make reservations programmatically
- Track affiliate commissions

### API Environments

| Environment | Base URL |
|-------------|----------|
| **Sandbox** (Development) | `https://sandbox.api.gnsvc.com/rest` |
| **Production** | `https://api.gnsvc.com/rest` |

### Supported Formats

- **Protocol**: HTTP/HTTPS (REST)
- **Data Formats**: JSON (recommended), XML
- **Authentication**: OAuth 2.0 / Custom Authorization Signature

---

## Getting Started

### Prerequisites

1. **GolfNow Account**: Create an account at [GolfNow.com](https://www.golfnow.com) if you don't have one
2. **API Access Request**: Submit a request at [affiliate.gnsvc.com](https://affiliate.gnsvc.com/getting-started)
3. **Partner Agreement**: Complete the affiliate/partner agreement with GolfNow

### Obtaining Credentials

Once approved, you'll receive:
- `UserName` - Your API username
- `Password` - Your API password
- `ClientApplicationSecret` - Used for secure authorization signatures
- `client_id` and `client_secret` - For OAuth flows (if applicable)
- `InventoryChannelID` - Your assigned distribution channel ID

---

## Authentication

GolfNow offers two authentication methods:

### Method 1: Simple Authentication (Development/Testing)

Pass your credentials directly in HTTP headers:

```http
POST /rest/system/status/secure-echo HTTP/1.1
Host: sandbox.api.gnsvc.com
Content-Type: application/json; charset=utf-8
UserName: your_username
Password: your_password

{}
```

### Method 2: Authorization Signature (Production - Recommended)

Generate a secure HMAC-SHA256 signature for production use:

#### Signature Generation Steps

1. Get current Unix timestamp (UTC)
2. SHA1 hash your password and Base64 encode it
3. Concatenate: `UserName + Base64(SHA1(Password)) + Timestamp`
4. HMAC-SHA256 sign using `ClientApplicationSecret`
5. Base64 encode the result

#### Node.js Signature Generation

```javascript
const crypto = require('crypto');

function generateAuthSignature(username, password, clientSecret) {
    // Get current Unix timestamp
    const timestamp = Math.floor(Date.now() / 1000);

    // SHA1 hash the password and base64 encode
    const passwordHash = crypto
        .createHash('sha1')
        .update(password)
        .digest('base64');

    // Concatenate components
    const signatureData = username + passwordHash + timestamp;

    // HMAC-SHA256 sign with client secret
    const signature = crypto
        .createHmac('sha256', clientSecret)
        .update(signatureData)
        .digest('base64');

    return {
        authorization: signature,
        timestamp: timestamp.toString()
    };
}

// Usage
const auth = generateAuthSignature(
    'your_username',
    'your_password',
    'your_client_secret'
);
```

#### HTTP Request with Authorization Signature

```http
POST /rest/system/status/secure-echo HTTP/1.1
Host: api.gnsvc.com
Content-Type: application/json; charset=utf-8
Authorization: {generated_signature}
Timestamp: {unix_timestamp}

{}
```

> **Important**: The timestamp is valid for only **one minute** and will be rejected if older.

### Customer Token Authentication

For user-specific operations, the API returns a `CustomerToken` in response headers:

```javascript
// Extract customer token from response headers
const customerToken = response.headers['customertoken'];

// Use in subsequent requests
const headers = {
    'CustomerToken': customerToken,
    'CustomerTokenTimeout': '30' // Token validity in minutes
};
```

---

## Core API Endpoints

### System Status (Test Connection)

```http
GET /rest/system/status/echo
```

**Secure Echo (Authenticated)**
```http
POST /rest/system/status/secure-echo
```

### Facilities & Courses

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rest/channel/{channelId}/facilities` | GET | Get facilities by channel |
| `/rest/channel/{channelId}/facilities?q=geo-location` | GET | Search by location |
| `/rest/facilities/{facilityId}` | GET | Get facility details |

### Tee Times

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rest/channel/{channelId}/facilities/{facilityId}/teetimes` | GET | Get available tee times |
| `/rest/channel/{channelId}/teetimes` | GET | Search tee times |

### Reservations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rest/customers/{email}/reservations` | POST | Create reservation |
| `/rest/customers/{email}/reservations/{id}` | GET | Get reservation details |
| `/rest/customers/{email}/reservations/{id}` | DELETE | Cancel reservation |

### Invoices

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/rest/invoices` | POST | Generate invoice |
| `/rest/invoices/{invoiceId}` | GET | Get invoice details |

---

## Tee Time Search

### Search by Geo-Location

```http
GET /rest/channel/{channelId}/facilities?q=geo-location&latitude=37.7749&longitude=-122.4194&proximity=25&expand=FacilityDetail.Ratesets HTTP/1.1
Host: sandbox.api.gnsvc.com
Content-Type: application/json
UserName: your_username
Password: your_password
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Query type (e.g., `geo-location`) |
| `latitude` | float | Geographic latitude |
| `longitude` | float | Geographic longitude |
| `proximity` | int | Search radius in miles |
| `expand` | string | Include additional data (e.g., `FacilityDetail.Ratesets`) |

### JavaScript Implementation

```javascript
const axios = require('axios');

class GolfNowAPI {
    constructor(username, password, channelId) {
        this.baseUrl = 'https://sandbox.api.gnsvc.com/rest';
        this.username = username;
        this.password = password;
        this.channelId = channelId;
    }

    getHeaders() {
        return {
            'Content-Type': 'application/json; charset=utf-8',
            'UserName': this.username,
            'Password': this.password
        };
    }

    async searchFacilitiesByLocation(latitude, longitude, proximity = 25) {
        const url = `${this.baseUrl}/channel/${this.channelId}/facilities`;

        try {
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                params: {
                    q: 'geo-location',
                    latitude: latitude,
                    longitude: longitude,
                    proximity: proximity,
                    expand: 'FacilityDetail.Ratesets'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error searching facilities:', error.response?.data || error.message);
            throw error;
        }
    }

    async getTeeTimesForFacility(facilityId, date) {
        const url = `${this.baseUrl}/channel/${this.channelId}/facilities/${facilityId}/teetimes`;

        try {
            const response = await axios.get(url, {
                headers: this.getHeaders(),
                params: {
                    date: date // Format: YYYY-MM-DD
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error fetching tee times:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Usage Example
const api = new GolfNowAPI('username', 'password', '11329');

// Search for courses near San Francisco
api.searchFacilitiesByLocation(37.7749, -122.4194, 30)
    .then(facilities => {
        console.log('Found facilities:', facilities);
    });
```

### Response Structure

```json
{
    "Facilities": [
        {
            "FacilityId": 12345,
            "Name": "Presidio Golf Course",
            "Address": {
                "Street1": "300 Finley Road",
                "City": "San Francisco",
                "State": "CA",
                "Zip": "94129"
            },
            "Location": {
                "Latitude": 37.7989,
                "Longitude": -122.4643
            },
            "Ratesets": [
                {
                    "RatesetId": 67890,
                    "TeeTimes": [
                        {
                            "TeeTimeId": 111222,
                            "Time": "2025-03-15T08:00:00",
                            "Rates": [
                                {
                                    "RateId": 333444,
                                    "Price": 75.00,
                                    "AvailableSpots": 4,
                                    "Description": "Standard Rate"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}
```

---

## Creating Bookings

### Booking Workflow

1. **Search** - Find available tee times
2. **Generate Invoice** - Create an invoice for the selected tee time
3. **Create Reservation Claim** - Prepare booking data
4. **Submit Booking** - POST to AddReservation endpoint

### Step 1: Generate Invoice

```javascript
async generateInvoice(teeTimeRateId, numberOfPlayers) {
    const url = `${this.baseUrl}/invoices`;

    const invoiceRequest = {
        TeeTimeRateId: teeTimeRateId,
        NumberOfPlayers: numberOfPlayers,
        InventoryChannelId: this.channelId
    };

    try {
        const response = await axios.post(url, invoiceRequest, {
            headers: this.getHeaders()
        });
        return response.data;
    } catch (error) {
        console.error('Error generating invoice:', error.response?.data || error.message);
        throw error;
    }
}
```

### Step 2: Create Reservation Claim Object

```javascript
function createReservationClaim(invoice, customerInfo, paymentInfo) {
    return {
        InventoryChannelId: invoice.InventoryChannelId,
        TeeTimeRateId: invoice.TeeTimeRateId,
        Invoice: invoice,
        FirstName: customerInfo.firstName,
        LastName: customerInfo.lastName,
        EmailAddress: customerInfo.email,
        PhoneNumber: customerInfo.phone,
        PaymentOptions: [
            {
                PaymentType: paymentInfo.type, // 'CreditCard' or 'AffiliatePayment'
                Amount: invoice.Pricing.DueOnline,
                ...paymentInfo.details
            }
        ]
    };
}
```

### Step 3: Submit Booking

```javascript
async createReservation(customerEmail, reservationClaim) {
    const url = `${this.baseUrl}/customers/${encodeURIComponent(customerEmail)}/reservations`;

    try {
        const response = await axios.post(url, reservationClaim, {
            headers: this.getHeaders()
        });

        // Store the reservation ID for future reference
        const reservationId = response.data.ReservationId;
        console.log('Booking confirmed! Reservation ID:', reservationId);

        return response.data;
    } catch (error) {
        console.error('Error creating reservation:', error.response?.data || error.message);
        throw error;
    }
}
```

### Complete Booking Example

```javascript
async function bookTeeTime(api, teeTimeRateId, customerInfo) {
    // Step 1: Generate Invoice
    const invoice = await api.generateInvoice(teeTimeRateId, customerInfo.players);

    console.log('Invoice generated:', {
        total: invoice.Pricing.Total,
        dueOnline: invoice.Pricing.DueOnline,
        dueAtCourse: invoice.Pricing.DueAtCourse
    });

    // Step 2: Create Reservation Claim
    const reservationClaim = {
        InventoryChannelId: api.channelId,
        TeeTimeRateId: teeTimeRateId,
        Invoice: invoice,
        FirstName: customerInfo.firstName,
        LastName: customerInfo.lastName,
        EmailAddress: customerInfo.email,
        PhoneNumber: customerInfo.phone,
        PaymentOptions: [
            {
                PaymentType: 'CreditCard',
                Amount: invoice.Pricing.DueOnline,
                CreditCardPayment: {
                    CardNumber: customerInfo.cardNumber,
                    ExpirationMonth: customerInfo.expMonth,
                    ExpirationYear: customerInfo.expYear,
                    CVV: customerInfo.cvv,
                    BillingZip: customerInfo.billingZip
                }
            }
        ]
    };

    // Step 3: Submit Booking
    const reservation = await api.createReservation(
        customerInfo.email,
        reservationClaim
    );

    return reservation;
}

// Usage
const customerInfo = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '555-123-4567',
    players: 4,
    cardNumber: '4111111111111111',
    expMonth: '12',
    expYear: '2026',
    cvv: '123',
    billingZip: '94102'
};

bookTeeTime(api, 'tee-time-rate-id', customerInfo)
    .then(reservation => {
        console.log('Booking successful!', reservation);
    });
```

---

## Affiliate Payments & Commission Tracking

### Prerequisites for Affiliate Payments

1. **GolfNow Approval** - Business unit must approve affiliate payment use
2. **Revenue Split Agreement** - GolfNow must have details on file
3. **Channel Configuration** - Inventory channel must be enabled for affiliate payments
4. **API Client Access** - Credentials must be granted affiliate payment access
5. **IP Whitelist** - Client machine IPs must be whitelisted

### Using Affiliate Payments

Replace standard `CreditCardPayment` with `AffiliatePayment`:

```javascript
const reservationClaim = {
    InventoryChannelId: channelId,
    TeeTimeRateId: teeTimeRateId,
    Invoice: invoice,
    FirstName: 'John',
    LastName: 'Doe',
    EmailAddress: 'john.doe@example.com',
    PaymentOptions: [
        {
            PaymentType: 'AffiliatePayment',
            Amount: invoice.Pricing.DueOnline,
            AffiliatePayment: {
                AffiliateTransactionId: 'your-unique-transaction-id',
                AffiliateReference: 'your-internal-reference'
            }
        }
    ]
};
```

### Commission Structure

Based on the GolfNow affiliate program:

| Metric | Commission |
|--------|------------|
| Per Round Booked | $1.00 - $4.00 |
| Per Click (some programs) | $0.10 |
| Typical Rate | ~$3.00 per round |

### Tracking Commissions

Access commission reports through:
- **Affiliate Portal**: Login at [affiliate.gnsvc.com](https://affiliate.gnsvc.com) to view earnings
- **API Endpoints**: Query invoice and reservation data for tracking

```javascript
async getAffiliateReservations(startDate, endDate) {
    const url = `${this.baseUrl}/affiliate/reservations`;

    try {
        const response = await axios.get(url, {
            headers: this.getHeaders(),
            params: {
                startDate: startDate,
                endDate: endDate
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching affiliate reservations:', error.response?.data || error.message);
        throw error;
    }
}
```

---

## Rate Limits & Best Practices

### Rate Limiting (Estimated)

GolfNow does not publicly document specific rate limits, but general best practices apply:

| Recommendation | Value |
|----------------|-------|
| Requests per minute | ~60 (conservative estimate) |
| Burst limit | ~10 requests/second |
| Retry after 429 | Wait for `Retry-After` header value |

### Best Practices

1. **Cache Facility Data**
   - Facility information changes infrequently
   - Cache for 24 hours, refresh daily

2. **Handle Rate Limits Gracefully**
   ```javascript
   async function makeRequestWithRetry(requestFn, maxRetries = 3) {
       for (let i = 0; i < maxRetries; i++) {
           try {
               return await requestFn();
           } catch (error) {
               if (error.response?.status === 429) {
                   const retryAfter = error.response.headers['retry-after'] || 60;
                   console.log(`Rate limited. Waiting ${retryAfter} seconds...`);
                   await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
               } else {
                   throw error;
               }
           }
       }
       throw new Error('Max retries exceeded');
   }
   ```

3. **Implement Request Queuing**
   ```javascript
   const Bottleneck = require('bottleneck');

   const limiter = new Bottleneck({
       minTime: 100,      // Minimum time between requests (ms)
       maxConcurrent: 5   // Maximum concurrent requests
   });

   const rateLimitedRequest = limiter.wrap(axios.get);
   ```

4. **Use Expand Parameters Wisely**
   - Only request data you need
   - Use `expand` parameter to reduce API calls

5. **Sandbox Testing**
   - Test thoroughly in sandbox before production
   - Sandbox allows booking at times ending in multiples of 10 (10:00, 10:10, etc.)
   - No actual charges or tee sheet updates occur

---

## SDK & Libraries

### Official Resources

- **API Documentation**: [api.gnsvc.com](https://api.gnsvc.com/)
- **Affiliate Portal**: [affiliate.gnsvc.com](https://affiliate.gnsvc.com/)
- **Getting Started Guide**: [affiliate.gnsvc.com/getting-started](https://affiliate.gnsvc.com/getting-started)

### Community SDKs

#### Node.js SDK (npm: golfnow)

```bash
npm install golfnow
```

```javascript
const golfnow = require('golfnow');

const app = golfnow('CLIENT_ID', 'CLIENT_SECRET');

// Get API root
const request = app.getApiRoot();
request.on('response', function(response) {
    console.log(response);
});
request.on('error', function(error) {
    console.log(error);
});
request.end();
```

**Repository**: [github.com/aleplusplus/golfnow-node-js](https://github.com/aleplusplus/golfnow-node-js)

> **Note**: This SDK was last updated in 2017 and may require updates for current API versions.

#### Alternative: node-golfnow

```bash
npm install node-golfnow
```

```javascript
const GolfNow = require('node-golfnow');

const client = new GolfNow({
    username: 'your_username',
    password: 'your_password'
});

// Uses axios under the hood
// Exposes: root, channels, course, courses, rateTags, invoices
```

**npm**: [npmjs.com/package/node-golfnow](https://www.npmjs.com/package/node-golfnow)

---

## Code Examples

### Complete Integration Class

```javascript
const axios = require('axios');
const crypto = require('crypto');

class GolfNowIntegration {
    constructor(config) {
        this.baseUrl = config.sandbox
            ? 'https://sandbox.api.gnsvc.com/rest'
            : 'https://api.gnsvc.com/rest';
        this.username = config.username;
        this.password = config.password;
        this.clientSecret = config.clientSecret;
        this.channelId = config.channelId;
        this.useSecureAuth = config.useSecureAuth || false;
    }

    // Generate secure authorization signature
    generateAuthSignature() {
        const timestamp = Math.floor(Date.now() / 1000);
        const passwordHash = crypto
            .createHash('sha1')
            .update(this.password)
            .digest('base64');

        const signatureData = this.username + passwordHash + timestamp;
        const signature = crypto
            .createHmac('sha256', this.clientSecret)
            .update(signatureData)
            .digest('base64');

        return { authorization: signature, timestamp: timestamp.toString() };
    }

    // Get authentication headers
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json; charset=utf-8'
        };

        if (this.useSecureAuth) {
            const auth = this.generateAuthSignature();
            headers['Authorization'] = auth.authorization;
            headers['Timestamp'] = auth.timestamp;
        } else {
            headers['UserName'] = this.username;
            headers['Password'] = this.password;
        }

        return headers;
    }

    // Test API connection
    async testConnection() {
        try {
            const response = await axios.post(
                `${this.baseUrl}/system/status/secure-echo`,
                {},
                { headers: this.getHeaders() }
            );
            console.log('Connection successful!');
            return true;
        } catch (error) {
            console.error('Connection failed:', error.response?.data || error.message);
            return false;
        }
    }

    // Search for golf courses by location
    async searchCourses(latitude, longitude, options = {}) {
        const { proximity = 25, expand = 'FacilityDetail.Ratesets' } = options;

        const url = `${this.baseUrl}/channel/${this.channelId}/facilities`;

        const response = await axios.get(url, {
            headers: this.getHeaders(),
            params: {
                q: 'geo-location',
                latitude,
                longitude,
                proximity,
                expand
            }
        });

        return response.data;
    }

    // Get tee times for a specific facility
    async getTeeTimes(facilityId, date) {
        const url = `${this.baseUrl}/channel/${this.channelId}/facilities/${facilityId}/teetimes`;

        const response = await axios.get(url, {
            headers: this.getHeaders(),
            params: { date }
        });

        return response.data;
    }

    // Search tee times with filters
    async searchTeeTimes(options) {
        const url = `${this.baseUrl}/channel/${this.channelId}/teetimes`;

        const response = await axios.get(url, {
            headers: this.getHeaders(),
            params: {
                latitude: options.latitude,
                longitude: options.longitude,
                proximity: options.proximity || 25,
                date: options.date,
                startTime: options.startTime,
                endTime: options.endTime,
                players: options.players || 1,
                priceMin: options.priceMin,
                priceMax: options.priceMax
            }
        });

        return response.data;
    }

    // Generate invoice for booking
    async generateInvoice(teeTimeRateId, numberOfPlayers) {
        const url = `${this.baseUrl}/invoices`;

        const response = await axios.post(url, {
            TeeTimeRateId: teeTimeRateId,
            NumberOfPlayers: numberOfPlayers,
            InventoryChannelId: this.channelId
        }, {
            headers: this.getHeaders()
        });

        return response.data;
    }

    // Create a reservation
    async createReservation(customerEmail, reservationData) {
        const url = `${this.baseUrl}/customers/${encodeURIComponent(customerEmail)}/reservations`;

        const response = await axios.post(url, reservationData, {
            headers: this.getHeaders()
        });

        return response.data;
    }

    // Get reservation details
    async getReservation(customerEmail, reservationId) {
        const url = `${this.baseUrl}/customers/${encodeURIComponent(customerEmail)}/reservations/${reservationId}`;

        const response = await axios.get(url, {
            headers: this.getHeaders()
        });

        return response.data;
    }

    // Cancel a reservation
    async cancelReservation(customerEmail, reservationId) {
        const url = `${this.baseUrl}/customers/${encodeURIComponent(customerEmail)}/reservations/${reservationId}`;

        const response = await axios.delete(url, {
            headers: this.getHeaders()
        });

        return response.data;
    }

    // Complete booking flow
    async bookTeeTime(teeTimeRateId, customer, payment) {
        // 1. Generate invoice
        const invoice = await this.generateInvoice(teeTimeRateId, customer.players);

        // 2. Build reservation claim
        const reservationClaim = {
            InventoryChannelId: this.channelId,
            TeeTimeRateId: teeTimeRateId,
            Invoice: invoice,
            FirstName: customer.firstName,
            LastName: customer.lastName,
            EmailAddress: customer.email,
            PhoneNumber: customer.phone,
            PaymentOptions: [payment]
        };

        // 3. Create reservation
        const reservation = await this.createReservation(
            customer.email,
            reservationClaim
        );

        return {
            reservationId: reservation.ReservationId,
            confirmationNumber: reservation.ConfirmationNumber,
            invoice,
            reservation
        };
    }
}

module.exports = GolfNowIntegration;
```

### Express.js API Routes Example

```javascript
const express = require('express');
const GolfNowIntegration = require('./golfnow-integration');

const router = express.Router();

const golfNow = new GolfNowIntegration({
    sandbox: process.env.NODE_ENV !== 'production',
    username: process.env.GOLFNOW_USERNAME,
    password: process.env.GOLFNOW_PASSWORD,
    clientSecret: process.env.GOLFNOW_CLIENT_SECRET,
    channelId: process.env.GOLFNOW_CHANNEL_ID,
    useSecureAuth: true
});

// Search courses near location
router.get('/courses', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;
        const courses = await golfNow.searchCourses(
            parseFloat(lat),
            parseFloat(lng),
            { proximity: parseInt(radius) || 25 }
        );
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get tee times for a course
router.get('/courses/:facilityId/teetimes', async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { date } = req.query;
        const teeTimes = await golfNow.getTeeTimes(facilityId, date);
        res.json(teeTimes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search tee times with filters
router.get('/teetimes/search', async (req, res) => {
    try {
        const teeTimes = await golfNow.searchTeeTimes({
            latitude: parseFloat(req.query.lat),
            longitude: parseFloat(req.query.lng),
            proximity: parseInt(req.query.radius) || 25,
            date: req.query.date,
            startTime: req.query.startTime,
            endTime: req.query.endTime,
            players: parseInt(req.query.players) || 1,
            priceMin: req.query.priceMin ? parseFloat(req.query.priceMin) : undefined,
            priceMax: req.query.priceMax ? parseFloat(req.query.priceMax) : undefined
        });
        res.json(teeTimes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create booking
router.post('/bookings', async (req, res) => {
    try {
        const { teeTimeRateId, customer, payment } = req.body;

        const booking = await golfNow.bookTeeTime(
            teeTimeRateId,
            customer,
            {
                PaymentType: 'CreditCard',
                Amount: payment.amount,
                CreditCardPayment: {
                    CardNumber: payment.cardNumber,
                    ExpirationMonth: payment.expMonth,
                    ExpirationYear: payment.expYear,
                    CVV: payment.cvv,
                    BillingZip: payment.billingZip
                }
            }
        );

        res.json(booking);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get booking details
router.get('/bookings/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const { email } = req.query;
        const reservation = await golfNow.getReservation(email, reservationId);
        res.json(reservation);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel booking
router.delete('/bookings/:reservationId', async (req, res) => {
    try {
        const { reservationId } = req.params;
        const { email } = req.query;
        await golfNow.cancelReservation(email, reservationId);
        res.json({ success: true, message: 'Booking cancelled' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
```

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failures

**Error**: `401 Unauthorized`

**Solutions**:
- Verify username and password are correct
- Check that credentials have API access enabled
- For signature auth, ensure timestamp is within 1 minute of server time
- Verify ClientApplicationSecret is correct

#### 2. Channel Access Denied

**Error**: `403 Forbidden` when accessing channel endpoints

**Solutions**:
- Confirm your ChannelId is correct
- Verify your account has access to the specified channel
- Contact GolfNow support to enable channel access

#### 3. Rate Limiting

**Error**: `429 Too Many Requests`

**Solutions**:
- Implement exponential backoff
- Check `Retry-After` header for wait time
- Reduce request frequency
- Implement caching for frequently accessed data

#### 4. Sandbox Booking Restrictions

**Issue**: Bookings fail in sandbox

**Note**: In sandbox, only tee times at multiples of 10 minutes can be booked (10:00, 10:10, 10:20, etc.)

#### 5. Invalid Invoice

**Error**: Invoice generation fails

**Solutions**:
- Verify TeeTimeRateId is valid and current
- Ensure tee time hasn't been booked by another user
- Check that number of players doesn't exceed availability

### Error Response Format

```json
{
    "Code": "ERROR_CODE",
    "Message": "Human readable error message",
    "Details": {
        "Field": "Additional context"
    }
}
```

### Support Resources

- **API Status**: Check [api.gnsvc.com](https://api.gnsvc.com/) for system status
- **Developer Portal**: [affiliate.gnsvc.com](https://affiliate.gnsvc.com/)
- **Request Access**: [api.gnsvc.com/pages/RequestAccess.aspx](https://api.gnsvc.com/pages/RequestAccess.aspx)
- **Partnership Inquiry**: [golfnow.com/business-partnership](https://www.golfnow.com/business-partnership)

---

## Next Steps for Your Integration

1. **Request API Access**: Submit application at [affiliate.gnsvc.com/getting-started](https://affiliate.gnsvc.com/getting-started)
2. **Set Up Sandbox**: Configure development environment with sandbox credentials
3. **Test Core Flows**: Implement and test search, invoice, and booking flows
4. **Affiliate Agreement**: Complete partnership agreement for commission tracking
5. **IP Whitelisting**: Submit production server IPs for affiliate payment access
6. **Go Live**: Switch to production endpoint and credentials

---

## Sources

- [GolfNow API Documentation](https://api.gnsvc.com/)
- [GolfNow Affiliate & Partner API](https://affiliate.gnsvc.com/)
- [GolfNow Getting Started Guide](https://affiliate.gnsvc.com/getting-started)
- [GolfNow Client Authentication](https://api.gnsvc.com/pages/Authentication.aspx)
- [Reservation Claims and Booking](https://api.gnsvc.com/pages/WorkflowExampleReservation.aspx)
- [GolfNow Affiliate Payments](https://api.gnsvc.com/pages/AffiliatePayments.aspx)
- [GolfNow Node.js SDK (GitHub)](https://github.com/aleplusplus/golfnow-node-js)
- [node-golfnow (npm)](https://www.npmjs.com/package/node-golfnow)
- [GolfNow Business Partnership](https://www.golfnow.com/business-partnership)

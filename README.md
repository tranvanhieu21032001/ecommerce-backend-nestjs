# NestJS Starter Project

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

A progressive Node.js framework for building efficient and scalable server-side applications.

---

## 🚀 Quick Start

| Action                   | Command              |
| :----------------------- | :------------------- |
| **Install Dependencies** | `npm install`        |
| **Development Mode**     | `npm run start:dev`  |
| **Build Project**        | `npm run build`      |
| **Production Mode**      | `npm run start:prod` |
| **Run Unit Tests**       | `npm run test`       |
| **Run E2E Tests**        | `npm run test:e2e`   |

---

## 🛠 Git Commit Convention

This project follows the **Conventional Commits** standard. Please use the following format: `<type>: <description>`

### Common Types:

- **feat**: A new feature for the user.
- **fix**: A bug fix.
- **refactor**: A code change that neither fixes a bug nor adds a feature.
- **docs**: Documentation only changes (README, comments).
- **style**: Changes that do not affect the meaning of the code (white-space, formatting).
- **test**: Adding missing tests or correcting existing tests.
- **chore**: Updating build tasks, package manager configs, etc.

> **Examples:**
>
> - `feat: add user authentication via JWT`
> - `fix: resolve memory leak in database connection`
> - `refactor: simplify data mapping logic in service`

---

## 📖 Resources

- **Documentation:** [NestJS Official Docs](https://docs.nestjs.com)
- **Devtools:** [NestJS Devtools](https://devtools.nestjs.com)
- **Support:** [Discord Community](https://discord.gg/G7Qnnhy)

## Google Sign-In

Create a Google OAuth 2.0 Web client and set the client ID in `.env`:

```env
GOOGLE_CLIENT_ID=your_google_web_client_id
```

The frontend must expose the same value as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Apply the user identity migration before accepting Google sign-ins:

```bash
npx prisma migrate deploy
```

## PayOS VietQR Payments

Set the PayOS credentials in `.env` before using VietQR payment endpoints:

```env
PAYOS_CLIENT_ID=your_client_id
PAYOS_API_KEY=your_api_key
PAYOS_CHECKSUM_KEY=your_checksum_key
```

Create an order with `paymentMethod` set to `PAYOS`, then create a VietQR payment link:

```http
POST /api/v1/payments/payos/orders/:orderId/payment-link
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "returnUrl": "http://localhost:3000/checkout/success",
  "cancelUrl": "http://localhost:3000/checkout/cancel"
}
```

The public webhook receiver is:

```http
POST /api/v1/payments/payos/webhook
```

An admin can register that public URL with PayOS through:

```http
POST /api/v1/payments/payos/webhook/confirm
```

PayOS VietQR payments use `VND`, so order totals paid through PayOS must be positive whole-number amounts.

## 📄 License

Nest is [MIT licensed](LICENSE).

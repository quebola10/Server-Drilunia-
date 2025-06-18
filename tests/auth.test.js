const request = require('supertest');
const app = require('../server'); // Asegúrate de exportar app en server.js

describe('Auth Endpoints', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@drilunia.com',
        password: '123456',
        name: 'Test User'
      });
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('user');
  });
}); 
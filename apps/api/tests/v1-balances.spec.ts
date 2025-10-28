import request from 'supertest'
import { app } from '../src/index'

describe('GET /v1/balances', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .get('/v1/balances')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: 'GET /v1/balances endpoint' })
  })
})
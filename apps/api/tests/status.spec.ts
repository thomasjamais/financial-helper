import request from 'supertest'
import { app } from '../src/index'

describe('GET /status', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .get('/status')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: 'GET /status endpoint' })
  })
})
import request from 'supertest'
import { app } from '../src/index'

describe('GET /healthz', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .get('/healthz')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: 'GET /healthz endpoint' })
  })
})
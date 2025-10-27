import request from 'supertest'
import { app } from '../src/index'

describe('GET /v1/ping', () => {
  it('should return { ok: true }', async () => {
    const response = await request(app)
      .get('/v1/ping')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true })
  })
})

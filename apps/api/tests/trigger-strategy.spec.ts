import request from 'supertest'
import { app } from '../src/index'

describe('POST /trigger/strategy', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .post('/trigger/strategy')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: 'POST /trigger/strategy endpoint' })
  })
})
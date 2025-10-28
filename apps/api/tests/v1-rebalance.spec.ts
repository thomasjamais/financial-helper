import request from 'supertest'
import { app } from '../src/index'

describe('POST /v1/rebalance', () => {
  it('should return success response', async () => {
    const response = await request(app)
      .post('/v1/rebalance')
      .expect(200)
    
    expect(response.body).toEqual({ ok: true, message: 'POST /v1/rebalance endpoint' })
  })
})
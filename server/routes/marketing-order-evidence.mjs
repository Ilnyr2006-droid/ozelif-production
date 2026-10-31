import {Router} from 'express';
import {createHash,timingSafeEqual} from 'node:crypto';
import {query} from '../lib/db.mjs';
import {readOrderEvidence} from '../lib/marketing-order-evidence.mjs';

function sameSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string')return false;
 const hash=s=>createHash('sha256').update(s).digest();
 return timingSafeEqual(hash(a),hash(b));
}
export function createMarketingOrderEvidenceRouter({
 queryFn=query,secret=process.env.OZELIF_MCP_ORDER_READ_TOKEN
}={}){
 const router=Router();
 router.get('/order-evidence',async(req,res)=>{
  res.set('Cache-Control','private, no-store, max-age=0');
  res.set('X-Robots-Tag','noindex, nofollow');
  if(typeof secret!=='string'||secret.length<32)
    return res.status(404).json({error:'not_available'});
  const auth=String(req.get('authorization')||'');
  if(!auth.startsWith('Bearer ')||!sameSecret(auth.slice(7),secret))
    return res.status(401).json({error:'unauthorized'});
  let result;
  try{
   result=await readOrderEvidence(queryFn,{
    campaignId:req.query.campaignId,dateFrom:req.query.dateFrom,dateTo:req.query.dateTo
   });
  }catch(e){
   if(['invalid_campaign_id','invalid_order_date','invalid_order_period'].includes(e.message))
     return res.status(400).json({error:'invalid_request'});
   // Never return SQL or customer records to clients.
   return res.status(503).json({error:'data_unavailable'});
  }
  return res.json(result);
 });
 return router;
}

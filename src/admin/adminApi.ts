
export type AdminUser={id:string;email:string;name:string;role:string}
export type Metrics={visitors_today:number;page_views_today:number;product_views_today:number;add_to_cart_today:number;categories_count:number;products_count:number;products_without_image:number;products_without_price:number;active_chats:number}
export type Category={id:string;name:string;slug:string;description:string;cover_image:string|null;is_published:boolean;products_count:number}
export type Product={id:string;category_id:string;category_name:string;name:string;slug:string;sku:string|null;base_price:string|null;unit:string|null;primary_image:string|null;is_published:boolean}
async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{credentials:'same-origin',headers:init?.body instanceof FormData?init.headers:{'Content-Type':'application/json',...init?.headers},...init})
  if(response.status===204)return undefined as T
  const body=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(body.error||`HTTP ${response.status}`)
  return body as T
}
export const adminApi={
  session:()=>request<{user:AdminUser}>('/api/admin/session'),
  login:(email:string,password:string)=>request<{user:AdminUser}>('/api/admin/login',{method:'POST',body:JSON.stringify({email,password})}),
  logout:()=>request<void>('/api/admin/logout',{method:'POST'}),
  dashboard:()=>request<{metrics:Metrics;recentActivity:Array<{action:string;entity_type:string;created_at:string}>}>('/api/admin/dashboard'),
  catalogs:()=>request<{items:Category[]}>('/api/admin/catalogs'),
  createCatalog:(payload:Record<string,unknown>)=>request('/api/admin/catalogs',{method:'POST',body:JSON.stringify(payload)}),
  products:()=>request<{items:Product[]}>('/api/admin/products'),
  createProduct:(payload:Record<string,unknown>)=>request('/api/admin/products',{method:'POST',body:JSON.stringify(payload)}),
  upload:(file:File)=>{const data=new FormData();data.append('file',file);return request<{url:string}>('/api/admin/uploads',{method:'POST',body:data})},
}

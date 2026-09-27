-- Uji perilaku RLS. Jalankan lewat scripts/test-rls.sh; setiap blok mencetak ekspektasinya.
\set ON_ERROR_STOP 0
-- seed auth users (trigger creates profiles)
INSERT INTO auth.users (id,email,raw_user_meta_data) VALUES
 ('a0000000-0000-0000-0000-000000000001','rian.pratama@umkt.ac.id','{"nim":"2311102441101","full_name":"Rian"}'),
 ('a0000000-0000-0000-0000-000000000002','sarah.amalia@umkt.ac.id','{"nim":"2311102441102","full_name":"Sarah"}'),
 ('a0000000-0000-0000-0000-000000000003','budi.santoso@umkt.ac.id','{"nim":"2311102441103","full_name":"Budi"}'),
 ('a0000000-0000-0000-0000-000000000004','dinda@umkt.ac.id','{}');
\echo '== gmail signup (expect ERROR)'
INSERT INTO auth.users (email) VALUES ('x@gmail.com');
SELECT nim FROM profiles WHERE email='dinda@umkt.ac.id';
UPDATE profiles SET role='sipen' WHERE id='a0000000-0000-0000-0000-000000000002';
UPDATE profiles SET role='km' WHERE id='a0000000-0000-0000-0000-000000000003';
INSERT INTO courses (id,code,name,lecturer_name,day_of_week,start_time,end_time) VALUES
 ('c1111111-1111-1111-1111-111111111111','TI-401','Cloud','Hendra','Senin','08:00','10:00'),
 ('c2222222-2222-2222-2222-222222222222','TI-402','ML','Nurul','Selasa','08:00','10:00');
INSERT INTO course_sipen (user_id,course_id) VALUES ('a0000000-0000-0000-0000-000000000002','c1111111-1111-1111-1111-111111111111');
INSERT INTO lecturer_tokens (token,course_id,label) VALUES ('tok-ok','c1111111-1111-1111-1111-111111111111','ok'),('tok-exp',NULL,'exp');
UPDATE lecturer_tokens SET expires_at=now()-interval '1 day' WHERE token='tok-exp';

SET ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
\echo '== student escalates role (expect ERROR)'
UPDATE profiles SET role='km' WHERE id=auth.uid();
\echo '== student updates phone (expect UPDATE 1)'
UPDATE profiles SET phone='0811' WHERE id=auth.uid();
\echo '== student inserts approved (expect ERROR rls)'
INSERT INTO leave_requests (student_id,course_id,leave_type,start_date,end_date,reason,status,created_by) VALUES (auth.uid(),'c1111111-1111-1111-1111-111111111111','sakit','2026-09-21','2026-09-21','x','approved',auth.uid());
\echo '== student proxy for other (expect ERROR rls)'
INSERT INTO leave_requests (student_id,course_id,leave_type,start_date,end_date,reason,created_by) VALUES ('a0000000-0000-0000-0000-000000000004','c1111111-1111-1111-1111-111111111111','sakit','2026-09-21','2026-09-21','x',auth.uid());
\echo '== student own pending (expect INSERT 1)'
INSERT INTO leave_requests (id,student_id,course_id,leave_type,start_date,end_date,reason,created_by) VALUES ('e0000000-0000-0000-0000-000000000001',auth.uid(),'c1111111-1111-1111-1111-111111111111','sakit','2026-09-21','2026-09-21','x',auth.uid());
\echo '== student approves own (expect UPDATE 0)'
UPDATE leave_requests SET status='approved', verified_by=auth.uid();

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000002","role":"authenticated"}',false);
\echo '== sipen proxy for Dinda in own course (expect INSERT 1)'
INSERT INTO leave_requests (id,student_id,course_id,leave_type,start_date,end_date,reason,created_by) VALUES ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000004','c1111111-1111-1111-1111-111111111111','sakit','2026-09-21','2026-09-21','x',auth.uid());
\echo '== sipen own request other course then (expect INSERT 1)'
INSERT INTO leave_requests (id,student_id,course_id,leave_type,start_date,end_date,reason,created_by) VALUES ('e0000000-0000-0000-0000-000000000003',auth.uid(),'c2222222-2222-2222-2222-222222222222','izin','2026-09-21','2026-09-21','x',auth.uid());
\echo '== sipen changes reason while approving (expect ERROR)'
UPDATE leave_requests SET status='approved', verified_by=auth.uid(), reason='hack' WHERE id='e0000000-0000-0000-0000-000000000001';
\echo '== sipen reject without reason (expect ERROR rls)'
UPDATE leave_requests SET status='rejected', verified_by=auth.uid() WHERE id='e0000000-0000-0000-0000-000000000001';
\echo '== sipen approves Rian in own course (expect UPDATE 1)'
UPDATE leave_requests SET status='approved', verified_by=auth.uid() WHERE id='e0000000-0000-0000-0000-000000000001';
\echo '== sipen approves own (expect UPDATE 0)'
UPDATE leave_requests SET status='approved', verified_by=auth.uid() WHERE id='e0000000-0000-0000-0000-000000000003';
\echo '== sipen sees count (expect 3: own + course c1)'
SELECT count(*) FROM leave_requests;

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000003","role":"authenticated"}',false);
\echo '== KM approves sipen request other course (expect UPDATE 1)'
UPDATE leave_requests SET status='approved', verified_by=auth.uid() WHERE id='e0000000-0000-0000-0000-000000000003';
\echo '== KM creates token (expect INSERT 1)'
INSERT INTO lecturer_tokens (label,created_by) VALUES ('new',auth.uid()) RETURNING length(token);

SELECT set_config('request.jwt.claims','{"sub":"a0000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
\echo '== student creates token (expect ERROR rls)'
INSERT INTO lecturer_tokens (label,created_by) VALUES ('hack',auth.uid());
\echo '== storage: upload to own folder ok, other folder fail'
INSERT INTO storage.objects (bucket_id,name) VALUES ('leave-attachments','a0000000-0000-0000-0000-000000000001/f.jpg');
INSERT INTO storage.objects (bucket_id,name) VALUES ('leave-attachments','a0000000-0000-0000-0000-000000000004/f.jpg');
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claims','',false);
\echo '== anon RPC ok / expired / missing'
SELECT get_lecturer_recap('tok-ok')->>'status', jsonb_array_length(get_lecturer_recap('tok-ok')->'leaves');
SELECT get_lecturer_recap('tok-exp')->>'status';
SELECT get_lecturer_recap('nope')->>'status';
\echo '== anon reads tokens table directly (expect 0 rows)'
SELECT count(*) FROM lecturer_tokens;
RESET ROLE;
SELECT id, status, verified_by IS NOT NULL v, verified_at IS NOT NULL t FROM leave_requests ORDER BY id;

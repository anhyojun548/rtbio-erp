-- RTBIO ERP — PostgreSQL 초기 스크립트
-- docker-entrypoint-initdb.d/ 로 주입되어 컨테이너 최초 기동 시 1회 실행됨.
-- Prisma migrate 가 실제 스키마를 만들지만, public 외 테넌트 스키마(tenant_{id})는
-- 런타임에서 생성하므로 여기서는 UTF-8 / 한국어 collation 보장만 처리.

-- UTF-8 확인 (Alpine postgres 기본값이지만 명시)
-- CREATE DATABASE 는 docker-compose 환경변수에서 이미 처리됨.

-- 멀티테넌시 샘플 스키마 (실제 테넌트는 애플리케이션에서 동적 생성)
-- 초기 개발용 tenant_altibio 스키마를 미리 만들어 둠.
CREATE SCHEMA IF NOT EXISTS tenant_altibio;

-- 확장 설치
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 거래처 검색용

COMMENT ON SCHEMA public IS 'RTBIO ERP 공용 스키마 (User, Tenant, AuditLog)';
COMMENT ON SCHEMA tenant_altibio IS '알티바이오 전용 데이터 스키마 (Product, Order, Inventory 등)';

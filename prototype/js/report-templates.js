/**
 * 알티바이오 ISO 13485 품질양식 (75개 중 핵심 8개) — JSON Schema 정의.
 *
 * 출처: docs/품질경영메뉴얼 등(주식회사 알티바이오)/3.양식모음/
 *
 * 각 양식의 fields 는 외부 AI 어시스턴트에 그대로 전달되며,
 * AI 는 동일한 id 를 키로 하는 JSON 응답을 돌려준다 (API contract).
 *
 * 인쇄/PDF 출력 시에는 알티바이오 원본 양식 레이아웃을 그대로 재현.
 */
const FORM_TEMPLATES = {
  // ════════════════════════════════════════════════════════════
  // F701-1 주문접수 및 검토대장 (대장형 — 여러 행)
  // ════════════════════════════════════════════════════════════
  'F701-1': {
    id: 'F701-1',
    code: 'F701-1',
    title: '주문접수 및 검토대장',
    type: 'register',  // 대장형: 여러 row 입력
    teams: ['admin', 'sales'],  // 작성 가능 팀
    description: '고객 주문 접수와 검토 이력을 기록하는 대장',
    rowFields: [
      { id: 'receiptDate',  label: '접수일자',    type: 'date', required: true },
      { id: 'category',     label: '구분',        type: 'select', options: ['신규','반복','특별','기타'], required: true },
      { id: 'customerName', label: '발주처',      type: 'text', required: true },
      { id: 'phone',        label: '연락처',      type: 'tel'},
      { id: 'productName',  label: '품명',        type: 'text', required: true },
      { id: 'spec',         label: '규격',        type: 'text'},
      { id: 'qty',          label: '수량',        type: 'number', required: true },
      { id: 'deliveryDate', label: '납기요구일자', type: 'date'},
      { id: 'receiptType',  label: '접수구분',    type: 'multiselect', options: ['유무선','Fax,문서','E-mail','방문'] },
      { id: 'requirementType', label: '요구사항 분류', type: 'multiselect',
        options: ['일반 주문접수','고객 요구사항','법적 요구사항','사용자 훈련 간 요구사항','추가 요구사항'] },
      { id: 'receiver',     label: '접수자',      type: 'text', required: true },
      { id: 'reviewer',     label: '검토자',      type: 'text'},
      { id: 'shippedDate',  label: '납품일자',    type: 'date'},
      { id: 'note',         label: '비고',        type: 'textarea'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F703-4 발주서 (단건형)
  // ════════════════════════════════════════════════════════════
  'F703-4': {
    id: 'F703-4',
    code: 'F703-4',
    title: '발주서',
    type: 'single',
    teams: ['admin', 'sales'],
    description: '외주/공급업체 자재 발주서',
    headerFields: [
      { id: 'companyName', label: '상호',     type: 'text', required: true },
      { id: 'address',     label: '주소',     type: 'text'},
      { id: 'phone',       label: '전화번호',  type: 'tel'},
      { id: 'orderDate',   label: '주문일자',  type: 'date', required: true },
      { id: 'deliveryDate',label: '납기일자',  type: 'date', required: true },
    ],
    rowFields: [
      { id: 'no',           label: '번호',          type: 'number'},
      { id: 'modelName',    label: '적용모델',      type: 'text'},
      { id: 'productName',  label: '품명',          type: 'text', required: true },
      { id: 'spec',         label: '규격',          type: 'text'},
      { id: 'qty',          label: '수량',          type: 'number', required: true },
      { id: 'deliveryDate', label: '납기일',        type: 'date'},
      { id: 'specialReq',   label: '특별 요구사항', type: 'text'},
      { id: 'lotNumber',    label: '제조번호',      type: 'text'},
      { id: 'mfgDate',      label: '제조일자',      type: 'date'},
    ],
    footerFields: [
      { id: 'supplyAmount', label: '공급가액', type: 'number'},
      { id: 'vat',          label: '부가세',  type: 'number'},
      { id: 'totalAmount',  label: '합계',    type: 'number'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F703-2 외주업체평가표 (체크리스트형)
  // ════════════════════════════════════════════════════════════
  'F703-2': {
    id: 'F703-2',
    code: 'F703-2',
    title: '외주업체 평가표',
    type: 'checklist',
    teams: ['admin', 'sales'],
    description: '외주/공급업체 5 카테고리 19항목 평가 (A/B/C/D)',
    headerFields: [
      { id: 'companyName', label: '업체명',  type: 'text', required: true },
      { id: 'evalDate',    label: '평가일',  type: 'date', required: true },
      { id: 'evaluator',   label: '작성자',  type: 'text', required: true },
      { id: 'approver',    label: '승인자',  type: 'text'},
    ],
    categories: [
      { name: '경영관리 및 공장관리', items: [
        { id: 'q1_1', label: '경영자의 품질에 대한 의식이 뚜렷한가'},
        { id: 'q1_2', label: '제조설비관리대장이 있으며 관리 상태는 양호한가'},
        { id: 'q1_3', label: '공장내의 안전 및 정리상태는 양호한가'},
        { id: 'q1_4', label: '작업표준에 의해 작업이 수행 되는가'},
      ]},
      { name: '자재의 품질상태', items: [
        { id: 'q2_1', label: '자재의 외관에 긁힘 이물질 등 이상 제품이 발견되지 않는가'},
        { id: 'q2_2', label: '자재에 대한 품질보증 인정서를 보유하고 있는가'},
        { id: 'q2_3', label: '불량률은 5% 미만인가'},
        { id: 'q2_4', label: '주문한 자재의 수량은 이상이 없는가'},
        { id: 'q2_5', label: '구매시방서에 맞는 사양의 자재가 입고 되었는가'},
      ]},
      { name: '자재 및 제품관리', items: [
        { id: 'q3_1', label: '자재 및 제품창고가 명확하게 설정되어 관리되고 있는가'},
        { id: 'q3_2', label: '납기기한은 준수되어지고 있는가'},
      ]},
      { name: '배송 서비스 등 기타', items: [
        { id: 'q4_1', label: '고객 불만사항에 대한 데이터를 수집·관리하고 있는가'},
        { id: 'q4_2', label: '당사의 거래에 협조적인가'},
        { id: 'q4_3', label: '출고제품에 라벨을 부착하여 관리하고 있는가'},
        { id: 'q4_4', label: '출고 시, 자재에 파손이 없게 포장이 잘 되어 있는가'},
        { id: 'q4_5', label: '불량품 발생시, 제품 회수에 협조적인가'},
      ]},
      { name: '업체의 청결상태', items: [
        { id: 'q5_1', label: '바닥, 설비, 작업장은 청결한가'},
        { id: 'q5_2', label: '작업장 조명, 냄새, 먼지, 소음 등이 적절한가'},
        { id: 'q5_3', label: '현장 및 사무실의 정리상태는 양호한가'},
      ]},
    ],
    scoreOptions: [
      { value: 'A', label: 'A — 매우 우수', score: 5 },
      { value: 'B', label: 'B — 우수',     score: 4 },
      { value: 'C', label: 'C — 보통',     score: 3 },
      { value: 'D', label: 'D — 미흡',     score: 1 },
    ],
    grades: [
      { min: 81, max: 100, grade: 'A'},
      { min: 71, max: 80,  grade: 'B'},
      { min: 61, max: 70,  grade: 'C'},
      { min: 0,  max: 60,  grade: 'D'},
    ],
    footerFields: [
      { id: 'totalScore', label: '전체 점수', type: 'number'},
      { id: 'finalGrade', label: '최종 등급', type: 'text'},
      { id: 'opinion',    label: '평가의견', type: 'textarea'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F801-1 고객불만접수대장 (대장형)
  // ════════════════════════════════════════════════════════════
  'F801-1': {
    id: 'F801-1',
    code: 'F801-1',
    title: '고객 불만 접수 대장',
    type: 'register',
    teams: ['admin', 'qc'],
    description: '거래처 클레임 접수 및 처리 이력',
    rowFields: [
      { id: 'receiptNo',     label: '접수NO',    type: 'text', required: true },
      { id: 'receiptDate',   label: '접수일자',  type: 'date', required: true },
      { id: 'customerName',  label: '고객명',    type: 'text', required: true },
      { id: 'phone',         label: '연락처',    type: 'tel'},
      { id: 'complaint',     label: '불만 내용', type: 'textarea', required: true },
      { id: 'receiver',      label: '접수자',    type: 'text', required: true },
      { id: 'processDate',   label: '처리일',    type: 'date'},
      { id: 'processContent',label: '처리내용',  type: 'textarea'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F803-2 최종검사성적서 (단건형)
  // ════════════════════════════════════════════════════════════
  'F803-2': {
    id: 'F803-2',
    code: 'F803-2',
    title: '최종검사성적서',
    type: 'single-with-rows',
    teams: ['qc'],
    description: '출고 전 제품 최종 QC 검사 기록',
    headerFields: [
      { id: 'productName',  label: '제품명(모델명)', type: 'text', required: true },
      { id: 'inspector',    label: '검사자',         type: 'text', required: true },
      { id: 'approver',     label: '승인자',         type: 'text'},
      { id: 'qty',          label: '수량',           type: 'number', required: true },
      { id: 'inspectDate',  label: '검사일자',       type: 'date', required: true },
      { id: 'lotNumber',    label: '제조번호',       type: 'text'},
      { id: 'testMethod',   label: '시험방식',       type: 'text'},
    ],
    rowFields: [
      { id: 'no',           label: '번호',     type: 'number'},
      { id: 'testItem',     label: '시험항목', type: 'text', required: true },
      { id: 'testStandard', label: '시험기준', type: 'text', required: true },
      { id: 'testResult',   label: '시험결과', type: 'text', required: true },
      { id: 'judgment',     label: '판정',     type: 'select', options: ['합격','불합격'], required: true },
    ],
    footerFields: [
      { id: 'specialNote',   label: '특이사항', type: 'textarea'},
      { id: 'finalJudgment', label: '종합판정', type: 'select', options: ['합격','불합격'], required: true },
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F804-1 부적합품보고서 (단건형)
  // ════════════════════════════════════════════════════════════
  'F804-1': {
    id: 'F804-1',
    code: 'F804-1',
    title: '부적합품 보고서',
    type: 'single',
    teams: ['qc', 'admin'],
    description: '품질 부적합 발생 시 처리 보고',
    headerFields: [
      { id: 'reportNo',       label: '발행번호',   type: 'text', required: true },
      { id: 'occurDate',      label: '발생일자',   type: 'date', required: true },
      { id: 'productName',    label: '제품명(모델명)', type: 'text', required: true },
      { id: 'department',     label: '발생부서',   type: 'text'},
      { id: 'qty',            label: '수량',       type: 'number'},
      { id: 'discoverer',     label: '발견자',     type: 'text', required: true },
      { id: 'occurType',      label: '부적합 발생 구분', type: 'select',
        options: ['인수','공정/중간','최종/제품','고객','기타'], required: true },
      { id: 'creator',        label: '작성자',     type: 'text'},
      { id: 'reviewer',       label: '검토자',     type: 'text'},
      { id: 'approver',       label: '승인자',     type: 'text'},
    ],
    bodyFields: [
      { id: 'description',    label: '부적합 내용', type: 'textarea', required: true },
      { id: 'cause',          label: '원인',       type: 'textarea'},
      { id: 'treatmentPlan',  label: '처리방안',   type: 'select',
        options: ['특채(CONCESSION)','수리(REPAIR)','폐기(REPEAL)','재등급(REGRADE)'] },
      { id: 'treatmentDetail',label: '처리내용',   type: 'textarea'},
      { id: 'attachment',     label: '첨부물 유무', type: 'select', options: ['유','무'] },
      { id: 'resultCheck',    label: '처리결과의 확인', type: 'select',
        options: ['처리결과 만족','재검사 합격','재검사 불합격'] },
      { id: 'correctiveAction', label: '시정조치 여부', type: 'select', options: ['예','아니오'] },
      { id: 'capaReportNo',   label: '시정 및 예방조치 보고서 No.', type: 'text'},
      { id: 'confirmer',      label: '처리확인자', type: 'text'},
    ],
  },

  // ════════════════════════════════════════════════════════════
  // F807-1 의료기기 이상사례 보고서 (UDI / 식약처 신고)
  // ════════════════════════════════════════════════════════════
  'F807-1': {
    id: 'F807-1',
    code: 'F807-1',
    title: '의료기기 이상사례 보고서',
    type: 'single',
    teams: ['admin', 'qc'],
    description: '식약처 보고용 의료기기 이상사례 — 법적 의무',
    sections: [
      {
        name: '보고 정보',
        fields: [
          { id: 'reportType',    label: '보고종류', type: 'select',
            options: ['최초보고','추가보고','최종보고'], required: true },
          { id: 'reportDate',    label: '보고일',  type: 'date', required: true },
          { id: 'reporterType',  label: '보고자 유형', type: 'select',
            options: ['의료기기제조업자','의료기기수입업자','의료기기수리업자','의료기기판매업자','의료기기임대업자','의료기관개설자','동물병원개설자','의사','한의사','간호사','소비자','기타'],
            required: true },
          { id: 'organization',  label: '보고 기관명', type: 'text', required: true },
          { id: 'reporterName',  label: '성명',     type: 'text', required: true },
          { id: 'phone',         label: '전화번호', type: 'tel', required: true },
          { id: 'email',         label: 'E-mail',   type: 'email'},
          { id: 'duplicate',     label: '식약처 동일사례 보고 여부', type: 'select',
            options: ['유','무','불명'] },
        ]
      },
      {
        name: '제품 정보 (UDI)',
        fields: [
          { id: 'productName',   label: '제품명',     type: 'text', required: true },
          { id: 'itemName',      label: '품목명',     type: 'text', required: true },
          { id: 'modelName',     label: '모델명',     type: 'text', required: true },
          { id: 'classCode',     label: '분류번호',   type: 'text', required: true },
          { id: 'grade',         label: '등급',       type: 'select', options: ['1','2','3','4'], required: true },
          { id: 'licenseNo',     label: '허가번호',   type: 'text', required: true },
          { id: 'lotNumber',     label: '제조번호(Lot 번호)', type: 'text', required: true },
          { id: 'manufacturer',  label: '회사명/제조원', type: 'text', required: true },
        ]
      },
      {
        name: '환자 정보',
        fields: [
          { id: 'patientName',   label: '성명',         type: 'text'},
          { id: 'patientGender', label: '성별',         type: 'select', options: ['남','여'] },
          { id: 'patientBirth',  label: '생년월일',     type: 'date'},
          { id: 'patientAge',    label: '나이(발생당시)', type: 'number'},
          { id: 'medicalHistory',label: '과거병력·합병증', type: 'textarea'},
        ]
      },
      {
        name: '이상사례',
        fields: [
          { id: 'awareDate',     label: '인지일',     type: 'date', required: true },
          { id: 'occurDate',     label: '발생일',     type: 'date', required: true },
          { id: 'endDate',       label: '종료일',     type: 'date'},
          { id: 'ongoing',       label: '현재 진행중', type: 'checkbox'},
          { id: 'severity',      label: '결과 및 위해정도', type: 'select',
            options: ['심각(Severe)','중증(Moderate)','경미(Mild)'], required: true },
          { id: 'severeType',    label: '심각 세부', type: 'multiselect',
            options: ['사망이나 생명에 위협','입원 또는 입원기간의 연장','회복이 불가능하거나 심각한 불구','선천적 기형 또는 이상을 초래'] },
          { id: 'detail',        label: '세부 내용', type: 'textarea', required: true },
        ]
      }
    ],
  },

  // ════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════
  // DR-DAILY-SALES 일일 매출 보고서 (경영지원팀, 2026-05 PDF 추가)
  // 양식: 작성일자/담당자/대표이사 + 거래처별 제품군 수량 + 월별 매출 푸터
  // ════════════════════════════════════════════════════════════
  'DR-DAILY-SALES': {
    id: 'DR-DAILY-SALES',
    code: 'DR-DAILY-SALES',
    title: '일일 매출 보고서',
    type: 'register',
    teams: ['admin', 'ceo'],
    description: '거래처별 제품군 수량 + 합계/공급가액/부가세 일일 집계',
    headerFields: [
      { id: 'reportDate', label: '작성일자', type: 'date', required: true },
      { id: 'creator',    label: '담당자',   type: 'text', required: true },
      { id: 'approver',   label: '대표이사', type: 'text' },
    ],
    rowFields: [
      { id: 'clientName',   label: '업체명',     type: 'text', required: true },
      { id: 'ricotap',      label: '리코탭',     type: 'number' },
      { id: 'sprint',       label: '리스프린트', type: 'number' },
      { id: 'neo',          label: '네오',       type: 'number' },
      { id: 'baroweltfit',  label: '바로웰핏',   type: 'number' },
      { id: 'longver',      label: '롱버전',     type: 'number' },
      { id: 'etc',          label: '기타',       type: 'number' },
      { id: 'totalQty',     label: '총 수량',    type: 'number' },
      { id: 'totalAmount',  label: '합계',       type: 'currency' },
      { id: 'supplyAmount', label: '공급가액',   type: 'currency' },
      { id: 'vat',          label: '부가세',     type: 'currency' },
      { id: 'salesRep',     label: '담당자',     type: 'select', options: ['박진우','배경동','신현호'] },
      { id: 'note',         label: '메모',       type: 'text' },
    ],
    footerFields: [
      { id: 'unilateralTotal', label: '편측 수량 합계',         type: 'number' },
      { id: 'bilateralTotal',  label: '양측 수량 합계',         type: 'number' },
      { id: 'monthSummary',    label: '월 총 출고/매출 요약',   type: 'textarea' },
    ],
  },

  // F501-1 경영검토 회의록 (단건형)
  // ════════════════════════════════════════════════════════════
  'F501-1': {
    id: 'F501-1',
    code: 'F501-1',
    title: '경영검토 회의록',
    type: 'single',
    teams: ['ceo', 'admin'],
    description: '경영진 정기 검토회의 회의록',
    headerFields: [
      { id: 'meetingDate', label: '회의일',  type: 'date', required: true },
      { id: 'location',    label: '장소',    type: 'text'},
      { id: 'attendees',   label: '참석자',  type: 'textarea', required: true },
      { id: 'chairperson', label: '의장',    type: 'text', required: true },
    ],
    bodyFields: [
      { id: 'agenda',         label: '안건',           type: 'textarea', required: true },
      { id: 'qmsReview',      label: '품질경영시스템 검토 결과', type: 'textarea'},
      { id: 'customerSatisfaction', label: '고객 만족도', type: 'textarea'},
      { id: 'auditResult',    label: '감사 결과',      type: 'textarea'},
      { id: 'capa',           label: '시정/예방 조치', type: 'textarea'},
      { id: 'resourceNeeds',  label: '자원 필요사항',   type: 'textarea'},
      { id: 'decisions',      label: '결정 사항',      type: 'textarea', required: true },
      { id: 'nextMeetingDate',label: '다음 회의 일정',  type: 'date'},
    ],
  },
};

/** 팀이 작성 가능한 양식 목록 */
function listFormsForTeam(team) {
  return Object.values(FORM_TEMPLATES).filter(t => t.teams.includes(team));
}

/** ID 로 양식 가져오기 */
function getFormTemplate(formId) {
  return FORM_TEMPLATES[formId] || null;
}

/** 양식의 모든 필드를 평탄화 — AI 호출 시 schema 로 사용 */
function flattenFormFields(template) {
  const fields = [];
  if (template.headerFields) fields.push(...template.headerFields);
  if (template.bodyFields)   fields.push(...template.bodyFields);
  if (template.rowFields)    fields.push(...template.rowFields.map(f => ({ ...f, isRow: true })));
  if (template.footerFields) fields.push(...template.footerFields);
  if (template.sections) {
    template.sections.forEach(sec => {
      sec.fields.forEach(f => fields.push({ ...f, sectionName: sec.name }));
    });
  }
  if (template.categories) {
    template.categories.forEach(cat => {
      cat.items.forEach(item => fields.push({
        id: item.id, label: item.label, type: 'select',
        options: (template.scoreOptions || []).map(o => o.value),
        category: cat.name,
      }));
    });
  }
  return fields;
}

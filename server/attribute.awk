#! /bin/awk -f
# ====================================================================
# usage
#   awk -f attribute.awk /ebs/www/sambuichi.jp/kcua/s3resource/s[0-9][0-9]/* > attribute.csv
#
# kcua.id 558d83ed61e2a603f16d9d24d0301a20
# kcua.uri https://s3-ap-northeast-1.amazonaws.com/sambuichi.jp/kcua/thumbnail/1971_s46/s46-02/s46_02_0031_2000.jpeg
# kcua.name s46_02_0031.tiff
# kcua.type s3object
# kcua.format image/jpeg
# kcua.thumbnail https://s3-ap-northeast-1.amazonaws.com/sambuichi.jp/kcua/thumbnail/1971_s46/s46-02/s46_02_0031_200.jpeg
# kcua.value.uuid 004e6039-b599-4c57-9e79-77a3f92b539d
# kcua.value.key kcua/archives/1971_s46/s46-02/s46_02_0031.tiff
# kcua.value.name s46_02_0031.tiff
# kcua.value.id s46_02_0031
# kcua.value.etag 558d83ed61e2a603f16d9d24d0301a20
# kcua.value.size 90811176
# kcua.value.source 作品記録冊子
# kcua.value.sequence 31
# kcua.value.group[0]
# kcua.value.assignment[0] 平面II
# kcua.value.content 発想とデッサン
# kcua.value.faculty[0]
# kcua.value.student[0]
# kcua.value.format tiff
# kcua.option s3object
# kcua.created 2020-02-29T06:37:02.003Z
# ====================================================================
BEGIN{
  # uuid id 元の場所(source) 分類(group) 表示順(sequence) 課題(assignment) 内容(content)
  # 担当教員(faculty) 学生名(student) ファイル形式(format)
  col[1]="kcua.value.uuid";
  col[2]="kcua.value.id";
  col[3]="kcua.value.source";
  col[4]="kcua.value.sequence";
  col[5]="kcua.value.group";
  col[6]="kcua.value.assignment";
  col[7]="kcua.value.content";
  col[8]="kcua.value.faculty";
  col[9]="kcua.value.student";
  col[10]="kcua.value.format";
  while (getline < "/ebs/www/sambuichi.jp/kcua/s3object/student.csv")
  { # uuid,年度(year),クラス(class),番号(number),学生(student),専攻(major)
    split($0,ft,",");
    uuid=ft[1];
    year=ft[2];
    class=ft[3];
    number=ft[4];
    student=ft[5];
    major=ft[6];
    name_of_student[uuid]=student;
  }
  close("/ebs/www/sambuichi.jp/kcua/s3object/student.csv");
  while (getline < "/ebs/www/sambuichi.jp/kcua/s3object/faculty.csv")
  { # uuid,年度(year),職位(position),教師(faculty),専門(speciality)
    split($0,ft,",");
    uuid=ft[1];
    year=ft[2];
    position=ft[3];
    faculty=ft[4];
    speciality=ft[5];
    name_of_faculty[uuid]=faculty;
  }
  close("/ebs/www/sambuichi.jp/kcua/s3object/faculty.csv");
}
{
  # initialize
  if (FNR==1) {
    if (NR==FNR) { }
    else {
      printf ("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n", v[col[1]], v[col[2]], v[col[3]], v[col[4]], group_v, assignment_v, v[col[7]], faculty_v, student_v, v[col[10]]);
    }
    split("", groups);
    split ("", assignments);
    split ("", faculties);
    split("", students);
    group_v="";
    assignment_v="";
    faculty_v="";
    student_v="";
  }
  # check value and set an array
  if ($1 ~ /.*\.value\.uuid/) {
    v[col[1]]=$2;
  }
  else if ($1 ~ /.*\.value\.id/) {
    v[col[2]]=$2;
  }
  else if ($1 ~ /.*\.value\.source/) {
    v[col[3]]=$2;
  }
  else if ($1 ~ /.*\.value\.sequence/) {
    v[col[4]]=$2;
  }
  else if ($1 ~ /.*\.value\.group/) {
    if (! ($2 in groups)) {
      groups[$2]=$2;
      if (! group_v) {group_v=$2}
      else {group_v=group_v " " $2;}
    }
  }
  else if ($1 ~ /.*\.value\.assignment/) {
    if (! ($2 in assignments)) {
      assignments[$2]=$2;
      if (! assignment_v) {assignment_v=$2;}
      else {assignment_v=assignment_v " " $2;}
    }
  }
  else if ($1 ~ /.*\.value\.content/) {
    val=$2;
    gsub(/[\x00-\x20]/," ",val);
    v[col[7]]=val;
  }
  else if ($1 ~ /.*\.value\.faculty/) {
    faculty_uuid=$2;
    if (faculty_uuid) {
      faculty_name=name_of_faculty[faculty_uuid];
      if (! (faculty_uuid in faculties)) {
        faculties[faculty_uuid]=faculty_name;
        if (! faculty_v) {faculty_v=faculty_name;}
        else {faculty_v=faculty_v " " faculty_name;}
      }
    }
  }
  else if ($1 ~ /.*\.value\.student/) {
    student_uuid=$2;
    if (student_uuid) {
      student_name=name_of_student[student_uuid];
      if (! (student_uuid in students)) {
        students[student_uuid]=student_name;
        if (! student_v) {student_v=student_name;}
        else {student_v=student_v " " student_name;}
      }
    }
  }
  else if ($1 ~ /.*\.value\.format/) {
    v[col[10]]=$2;
  }
}
END{
  printf ("\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",\"%s\"\n", v[col[1]], v[col[2]], v[col[3]], v[col[4]], group_v, assignment_v, v[col[7]], faculty_v, student_v, v[col[10]]);
}

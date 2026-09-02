// Crea un comercio de prueba con un owner y un empleado.
// Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local (Project Settings > API en Supabase).
// Ejecutar con: node scripts/seed-users.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const path = join(__dirname, "..", ".env.local");
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim();
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OWNER = {
  email: "owner@verificapay.test",
  password: "VerificaPay123!",
  fullName: "Dueño de Prueba",
  businessName: "Comercio de Prueba",
};

const EMPLOYEE = {
  email: "empleado@verificapay.test",
  password: "VerificaPay123!",
  fullName: "Empleado de Prueba",
  shift: "Mañana",
};

async function createAuthUser({ email, password }) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Creando usuario ${email}: ${error.message}`);
  return data.user;
}

async function main() {
  console.log("Creando organización...");
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: OWNER.businessName })
    .select("id, invite_code")
    .single();
  if (orgError) throw new Error(`Creando organización: ${orgError.message}`);
  console.log(`Organización creada: ${org.id} (invite_code: ${org.invite_code})`);

  console.log(`Creando owner (${OWNER.email})...`);
  const ownerUser = await createAuthUser(OWNER);
  const { error: ownerProfileError } = await supabase.from("profiles").insert({
    id: ownerUser.id,
    organization_id: org.id,
    full_name: OWNER.fullName,
    role: "owner",
  });
  if (ownerProfileError)
    throw new Error(`Perfil owner: ${ownerProfileError.message}`);

  console.log(`Creando empleado (${EMPLOYEE.email})...`);
  const employeeUser = await createAuthUser(EMPLOYEE);
  const { error: employeeProfileError } = await supabase
    .from("profiles")
    .insert({
      id: employeeUser.id,
      organization_id: org.id,
      full_name: EMPLOYEE.fullName,
      role: "employee",
      shift: EMPLOYEE.shift,
    });
  if (employeeProfileError)
    throw new Error(`Perfil empleado: ${employeeProfileError.message}`);

  console.log("\nListo. Credenciales de prueba:");
  console.log(`  Owner:    ${OWNER.email} / ${OWNER.password}`);
  console.log(`  Empleado: ${EMPLOYEE.email} / ${EMPLOYEE.password}`);
  console.log(`  Invite code del comercio: ${org.invite_code}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

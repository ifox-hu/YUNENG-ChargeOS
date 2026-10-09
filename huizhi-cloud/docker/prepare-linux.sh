#!/usr/bin/env bash
set -euo pipefail
docker_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$docker_dir/../.." && pwd)"
cd "$repo_dir/huizhi-cloud"
mvn package -DskipTests
copy_jar() {
  mkdir -p "$docker_dir/$2/jar"
  cp "$repo_dir/huizhi-cloud/$1/target/$3.jar" "$docker_dir/$2/jar/$3.jar"
}
copy_jar hcp-gateway hcp/gateway hcp-gateway
copy_jar hcp-auth hcp/auth hcp-auth
copy_jar hcp-demo hcp/demo hcp-demo
copy_jar hcp-visual/hcp-monitor hcp/visual/monitor hcp-monitor
for module in system file gen job mp operator simulator; do
  copy_jar "hcp-modules/hcp-$module" "hcp/modules/$module" "hcp-$module"
done
cd "$repo_dir/huizhi-admin"
npm ci
NODE_OPTIONS=--openssl-legacy-provider ./node_modules/.bin/vue-cli-service build
mkdir -p "$docker_dir/nginx/html/dist"
cp -a dist/. "$docker_dir/nginx/html/dist/"
echo 'Build complete. Run bash huizhi-cloud/docker/start-linux.sh from the repository root.'

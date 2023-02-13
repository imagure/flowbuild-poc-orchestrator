# Flowbuild Orchestrator
Orchestrator for flowbuild environment.

# Run on your localhost:
* Setup:
```
pnpm i
pnpm run prepare
```
* Running:
```
pnpm run start:dev    # will run ts-node
```
or
```
pnpm run build
pnpm run start
```

## Run KAFKA through docker-compose file:
```
docker-compose up --build
```

## App monitoring:
To get application behavior, you might use climem (reference: https://www.npmjs.com/package/climem)

It's a quick setup:
```
pnpm i climem -D
export CLIMEM=8998 && ts-node -r climem -r tsconfig-paths/register ./src/index.ts
```

To see memory usage:
```
climem 8998 localhost
```